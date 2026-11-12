using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

// Writes the exe icon: the tray coin (TrayMenu.CoinBitmap, the same drawing code) at 16, 24, 32 and 48 px as 32-bit
// bitmaps with an AND mask, and at 256 px as PNG. Usage: make-icon <out.ico>   (tools\make-icon.ps1 builds and runs it)
public static class MakeIcon
{
    static readonly int[] Sizes = { 16, 24, 32, 48, 256 };

    public static int Main(string[] args)
    {
        var images = new List<byte[]>();
        foreach (int s in Sizes)
            using (Bitmap b = TrayMenu.CoinBitmap(s)) images.Add(s >= 256 ? Png(b) : Dib(b));
        using (var ms = new MemoryStream())
        using (var w = new BinaryWriter(ms))
        {
            w.Write((short)0); w.Write((short)1); w.Write((short)Sizes.Length);   // ICONDIR: reserved, type icon, count
            int offset = 6 + 16 * Sizes.Length;
            for (int i = 0; i < Sizes.Length; i++)
            {
                int s = Sizes[i];
                w.Write((byte)(s >= 256 ? 0 : s)); w.Write((byte)(s >= 256 ? 0 : s));   // 0 = 256
                w.Write((byte)0); w.Write((byte)0);                                    // no palette, reserved
                w.Write((short)1); w.Write((short)32);                                 // planes, bits per pixel
                w.Write(images[i].Length); w.Write(offset);
                offset += images[i].Length;
            }
            foreach (byte[] img in images) w.Write(img);
            w.Flush();
            File.WriteAllBytes(args[0], ms.ToArray());
        }
        Console.WriteLine("wrote " + args[0] + " (" + string.Join(", ", Array.ConvertAll(Sizes, delegate(int s) { return s + " px"; })) + ")");
        return 0;
    }

    static byte[] Png(Bitmap b)
    {
        using (var ms = new MemoryStream())
        {
            b.Save(ms, ImageFormat.Png);
            return ms.ToArray();
        }
    }

    // BITMAPINFOHEADER (height doubled for the mask), BGRA rows bottom-up, then the 1-bit AND mask (1 = transparent).
    static byte[] Dib(Bitmap b)
    {
        int s = b.Width, maskStride = (s + 31) / 32 * 4;
        BitmapData d = b.LockBits(new Rectangle(0, 0, s, s), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        byte[] px = new byte[d.Stride * s];
        Marshal.Copy(d.Scan0, px, 0, px.Length);
        b.UnlockBits(d);
        using (var ms = new MemoryStream())
        using (var w = new BinaryWriter(ms))
        {
            w.Write(40); w.Write(s); w.Write(s * 2); w.Write((short)1); w.Write((short)32);
            w.Write(0); w.Write(s * s * 4 + maskStride * s); w.Write(0); w.Write(0); w.Write(0); w.Write(0);
            for (int y = s - 1; y >= 0; y--) w.Write(px, y * d.Stride, s * 4);
            for (int y = s - 1; y >= 0; y--)
            {
                byte[] row = new byte[maskStride];
                for (int x = 0; x < s; x++)
                    if (px[y * d.Stride + x * 4 + 3] == 0) row[x / 8] |= (byte)(0x80 >> (x % 8));
                w.Write(row);
            }
            w.Flush();
            return ms.ToArray();
        }
    }
}
