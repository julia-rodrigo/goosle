package app.goosle

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsTest {
    /** Builds an IPv4/UDP packet from 10.111.222.1:40000 to 10.111.222.2:53 asking for [name] (type A). */
    private fun query(name: String, id: Int = 0x1234): ByteArray {
        val q = java.io.ByteArrayOutputStream()
        q.write(byteArrayOf((id shr 8).toByte(), id.toByte(), 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 1))
        for (label in name.split('.')) { q.write(label.length); q.write(label.toByteArray()) }
        q.write(0); q.write(byteArrayOf(0, 1, 0, 1))
        // EDNS OPT record in "additional", which a blocked answer must drop.
        q.write(byteArrayOf(0, 0, 41, 0x10, 0, 0, 0, 0, 0, 0, 0))
        val dns = q.toByteArray()
        val total = 28 + dns.size
        val p = ByteArray(total)
        p[0] = 0x45; p[2] = (total shr 8).toByte(); p[3] = total.toByte(); p[8] = 64; p[9] = 17
        byteArrayOf(10, 111, 222.toByte(), 1).copyInto(p, 12)
        byteArrayOf(10, 111, 222.toByte(), 2).copyInto(p, 16)
        p[20] = (40000 shr 8).toByte(); p[21] = 40000.toByte(); p[23] = 53
        p[24] = ((8 + dns.size) shr 8).toByte(); p[25] = (8 + dns.size).toByte()
        dns.copyInto(p, 28)
        return p
    }

    private fun u16(b: ByteArray, o: Int) = ((b[o].toInt() and 0xFF) shl 8) or (b[o + 1].toInt() and 0xFF)

    @Test fun parsesQueryName() {
        val q = Dns.parseQuery(query("ads.doubleclick.net"))!!
        assertEquals("ads.doubleclick.net", q.name)
        assertEquals(20, q.ipHeaderLen)
    }

    @Test fun ignoresNonDns() {
        val p = query("example.com"); p[23] = 80
        assertNull(Dns.parseQuery(p))
        val tcp = query("example.com"); tcp[9] = 6
        assertNull(Dns.parseQuery(tcp))
    }

    @Test fun blockedAnswerIsNxdomainBackToAsker() {
        val req = query("ads.doubleclick.net", id = 0xBEEF)
        val q = Dns.parseQuery(req)!!
        val r = Dns.blockedResponse(req, q)
        // IP: swapped addresses, valid header checksum.
        assertEquals(listOf(10, 111, 222, 2), (12..15).map { r[it].toInt() and 0xFF })
        assertEquals(listOf(10, 111, 222, 1), (16..19).map { r[it].toInt() and 0xFF })
        var sum = 0L; for (i in 0 until 20 step 2) sum += u16(r, i)
        while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
        assertEquals(0xFFFF, sum.toInt())
        assertEquals(r.size, u16(r, 2))
        // UDP: from 53 back to the asker's port, right length.
        assertEquals(53, u16(r, 20)); assertEquals(40000, u16(r, 22)); assertEquals(r.size - 20, u16(r, 24))
        // DNS: same id, response + NXDOMAIN, one question, nothing else.
        assertEquals(0xBEEF, u16(r, 28))
        assertTrue((r[30].toInt() and 0x80) != 0)
        assertEquals(3, r[31].toInt() and 0x0F)
        assertEquals(1, u16(r, 32)); assertEquals(0, u16(r, 34)); assertEquals(0, u16(r, 38))
        assertEquals(q.questionEnd, r.size - 28)
    }

    @Test fun parsesHostsFiles() {
        val set = Blocklist.parse("# comment\n0.0.0.0 ads.example.com\n127.0.0.1 t.example.org # x\nplain.example.net\n0.0.0.0 0.0.0.0\nlocalhost\n")
        assertEquals(setOf("ads.example.com", "t.example.org", "plain.example.net"), set)
    }
}
