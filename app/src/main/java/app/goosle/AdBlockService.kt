package app.goosle

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Phone-wide ad and tracker blocker.
 *
 * Runs a local VPN that only carries DNS lookups (nothing else is routed through it).
 * Lookups for ad/tracker domains get "no such domain"; everything else is forwarded
 * to the chosen DNS provider. Works for every app and browser that uses the phone's DNS.
 */
class AdBlockService : VpnService() {
    private var tun: ParcelFileDescriptor? = null
    private var reader: Thread? = null
    private val pool = Executors.newFixedThreadPool(8)
    @Volatile private var running = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopBlocking()
            stopSelf()
            return START_NOT_STICKY
        }
        startBlocking()
        return START_STICKY
    }

    override fun onRevoke() {
        // Another VPN took over, or the user turned it off in system settings.
        Prefs(this).adBlock = false
        stopBlocking()
        stopSelf()
    }

    override fun onDestroy() {
        stopBlocking()
        pool.shutdownNow()
        super.onDestroy()
    }

    /* ---------------------------------------------------------------- */

    private fun startBlocking() {
        if (running) return
        val prefs = Prefs(this)
        Blocklist.load(this)

        val builder = Builder()
            .setSession("Goosle ad blocker")
            .addAddress(TUN_ADDRESS, 32)
            .addDnsServer(FAKE_DNS)
            .addRoute(FAKE_DNS, 32) // only DNS to our fake server enters the tunnel
            .setBlocking(true)
        for (pkg in prefs.adBlockExcludedApps) runCatching { builder.addDisallowedApplication(pkg) }
        if (android.os.Build.VERSION.SDK_INT >= 29) builder.setMetered(false)

        tun = runCatching { builder.establish() }.getOrNull()
        val fd = tun ?: run {
            Log.w(TAG, "VPN not permitted")
            prefs.adBlock = false
            stopSelf()
            return
        }
        running = true
        status = "on"
        reader = Thread({ loop(fd, prefs) }, "goosle-dns").also { it.start() }
    }

    private fun stopBlocking() {
        running = false
        status = "off"
        runCatching { tun?.close() }
        tun = null
        reader?.interrupt()
        reader = null
    }

    private fun loop(fd: ParcelFileDescriptor, prefs: Prefs) {
        val input = FileInputStream(fd.fileDescriptor)
        val output = FileOutputStream(fd.fileDescriptor)
        val buf = ByteArray(32767)
        val upstream = InetAddress.getByName(prefs.adBlockUpstream)
        while (running) {
            val n = try { input.read(buf) } catch (_: Exception) { break }
            if (n <= 0) continue
            val packet = buf.copyOf(n)
            val q = Dns.parseQuery(packet) ?: continue

            val allowed = Blocklist.isAllowed(q.name, prefs)
            if (!allowed && Blocklist.isBlocked(q.name, prefs)) {
                record(q.name)
                write(output, Dns.blockedResponse(packet, q))
                continue
            }
            pool.execute {
                try {
                    DatagramSocket().use { sock ->
                        protect(sock) // keep the forwarded lookup out of our own tunnel
                        sock.soTimeout = 5000
                        sock.send(DatagramPacket(q.payload, q.payload.size, upstream, 53))
                        val resp = ByteArray(4096)
                        val p = DatagramPacket(resp, resp.size)
                        sock.receive(p)
                        write(output, Dns.wrapResponse(packet, q, resp.copyOf(p.length)))
                    }
                } catch (_: Exception) {
                    // Timeout or network change; the app will retry its lookup.
                }
            }
        }
    }

    private fun write(out: FileOutputStream, packet: ByteArray) {
        synchronized(out) { runCatching { out.write(packet) } }
    }

    private fun record(domain: String) {
        blockedCount.incrementAndGet()
        synchronized(recent) {
            recent.remove(domain)
            recent.addLast(domain)
            while (recent.size > 100) recent.removeFirst()
        }
    }

    companion object {
        private const val TAG = "GoosleAdBlock"
        const val ACTION_STOP = "app.goosle.adblock.STOP"
        private const val TUN_ADDRESS = "10.111.222.1"
        private const val FAKE_DNS = "10.111.222.2"

        @Volatile var status = "off"
            private set
        /** Blocked lookups since the blocker last started. */
        val blockedCount = AtomicInteger(0)
        /** Most recently blocked domains, newest last. */
        val recent = ArrayDeque<String>()

        fun start(ctx: Context) {
            ctx.startService(Intent(ctx, AdBlockService::class.java))
        }

        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, AdBlockService::class.java).setAction(ACTION_STOP))
        }
    }
}

/* -------------------------------------------------------------------- */
/* Blocklist                                                             */
/* -------------------------------------------------------------------- */

object Blocklist {
    @Volatile private var domains: Set<String> = emptySet()
    @Volatile var source: String = "not loaded"
        private set

    const val UPDATE_URL = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"

    private fun file(ctx: Context) = File(ctx.filesDir, "blocklist.txt")

    val size get() = domains.size

    @Synchronized
    fun load(ctx: Context, force: Boolean = false) {
        if (domains.isNotEmpty() && !force) return
        val f = file(ctx)
        val text = if (f.exists()) f.readText().also { source = "updated list" }
        else ctx.assets.open("blocklist.txt").bufferedReader().readText().also { source = "built-in list" }
        domains = parse(text)
    }

    /** Accepts plain domain lists and hosts files ("0.0.0.0 example.com"). */
    fun parse(text: String): Set<String> {
        val out = HashSet<String>(100_000)
        text.lineSequence().forEach { raw ->
            val line = raw.substringBefore('#').trim()
            if (line.isEmpty()) return@forEach
            val parts = line.split(Regex("\\s+"))
            val d = (if (parts.size >= 2 && (parts[0] == "0.0.0.0" || parts[0] == "127.0.0.1")) parts[1] else parts[0]).lowercase()
            if (d.contains('.') && d != "0.0.0.0" && d != "localhost") out.add(d)
        }
        return out
    }

    /** Downloads the latest list. Call off the main thread. Returns the number of domains. */
    fun update(ctx: Context): Int {
        val conn = URL(UPDATE_URL).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000
        conn.readTimeout = 30000
        val text = conn.inputStream.bufferedReader().use { it.readText() }
        val parsed = parse(text)
        require(parsed.size > 10_000) { "List looks wrong (${parsed.size} entries)" }
        file(ctx).writeText(parsed.joinToString("\n"))
        domains = parsed
        source = "updated list"
        return parsed.size
    }

    private fun matches(name: String, set: Collection<String>): Boolean {
        var d = name.lowercase().trimEnd('.')
        while (true) {
            if (d in set) return true
            val dot = d.indexOf('.')
            if (dot < 0 || d.indexOf('.', dot + 1) < 0) return false // stop before the bare TLD
            d = d.substring(dot + 1)
        }
    }

    fun isBlocked(name: String, prefs: Prefs) = matches(name, domains) || matches(name, prefs.adBlockExtraDomains)
    fun isAllowed(name: String, prefs: Prefs) = matches(name, prefs.adBlockAllowedDomains)
}

/* -------------------------------------------------------------------- */
/* Minimal IPv4/UDP/DNS handling                                         */
/* -------------------------------------------------------------------- */

object Dns {
    class Query(val name: String, val ipHeaderLen: Int, val payload: ByteArray, val questionEnd: Int)

    /** Returns the DNS query in an IPv4/UDP packet to port 53, or null for anything else. */
    fun parseQuery(p: ByteArray): Query? {
        if (p.size < 28 || (p[0].toInt() shr 4) != 4 || p[9].toInt() != 17) return null
        val ihl = (p[0].toInt() and 0x0F) * 4
        if (p.size < ihl + 8 + 12) return null
        val dstPort = u16(p, ihl + 2)
        if (dstPort != 53) return null
        val payload = p.copyOfRange(ihl + 8, p.size)
        if (u16(payload, 4) < 1) return null // no question
        var i = 12
        val sb = StringBuilder()
        while (i < payload.size) {
            val len = payload[i].toInt() and 0xFF
            if (len == 0) { i++; break }
            if (len and 0xC0 != 0 || i + 1 + len > payload.size) return null
            if (sb.isNotEmpty()) sb.append('.')
            sb.append(String(payload, i + 1, len, Charsets.US_ASCII))
            i += 1 + len
        }
        if (i + 4 > payload.size) return null
        return Query(sb.toString(), ihl, payload, i + 4)
    }

    /** "No such domain" answer to [q]. */
    fun blockedResponse(packet: ByteArray, q: Query): ByteArray {
        val dns = q.payload.copyOf(q.questionEnd)
        dns[2] = (0x80 or (dns[2].toInt() and 0x79)).toByte() // QR=1, keep opcode and RD
        dns[3] = 0x83.toByte() // RA=1, RCODE=NXDOMAIN
        dns[4] = 0; dns[5] = 1 // one question
        for (k in 6..11) dns[k] = 0 // no answers/authority/additional
        return wrapResponse(packet, q, dns)
    }

    /** Wraps a DNS answer in an IPv4/UDP packet going back to whoever asked. */
    fun wrapResponse(request: ByteArray, q: Query, dns: ByteArray): ByteArray {
        val ihl = q.ipHeaderLen
        val total = 20 + 8 + dns.size
        val out = ByteArray(total)
        out[0] = 0x45
        put16(out, 2, total)
        out[8] = 64 // TTL
        out[9] = 17 // UDP
        System.arraycopy(request, 16, out, 12, 4) // src = original dst
        System.arraycopy(request, 12, out, 16, 4) // dst = original src
        put16(out, 10, checksum(out, 0, 20))
        put16(out, 20, u16(request, ihl + 2)) // src port = 53
        put16(out, 22, u16(request, ihl))     // dst port = asker's port
        put16(out, 24, 8 + dns.size)
        // UDP checksum 0 = not computed, allowed for IPv4.
        System.arraycopy(dns, 0, out, 28, dns.size)
        return out
    }

    private fun u16(b: ByteArray, o: Int) = ((b[o].toInt() and 0xFF) shl 8) or (b[o + 1].toInt() and 0xFF)
    private fun put16(b: ByteArray, o: Int, v: Int) { b[o] = (v shr 8).toByte(); b[o + 1] = v.toByte() }

    private fun checksum(b: ByteArray, off: Int, len: Int): Int {
        var sum = 0L
        var i = off
        while (i < off + len) { sum += u16(b, i); i += 2 }
        while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
        return (sum.inv() and 0xFFFF).toInt()
    }
}
