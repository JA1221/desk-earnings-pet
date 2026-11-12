using System;

// The two calls that make PetWindow see-through (docs/spikes/transparency.md): DWM blur-behind (DWM honours the
// window's per-pixel alpha) and SetLayeredWindowAttributes (layered, needed for click-through). Either can fail on a
// Windows the app was not tried on (an older Windows 10, a remote or virtual desktop); that is not fatal: the window
// goes on with an opaque background (init forceOpaque: true, the page paints #FFF8EC) and the failure is logged once.
public static class Transparency
{
    public const int PaperArgb = unchecked((int)0xFFFFF8EC);   // #FFF8EC, the A1 page background

    // What failed, for error.log; null when both calls worked. blurHr: DwmEnableBlurBehindWindow's HRESULT;
    // layeredOk / layeredError: SetLayeredWindowAttributes' result and its GetLastWin32Error.
    public static string Failure(int blurHr, bool layeredOk, int layeredError)
    {
        string blur = blurHr < 0 ? "DwmEnableBlurBehindWindow 0x" + blurHr.ToString("X8") : null;
        string layered = layeredOk ? null : "SetLayeredWindowAttributes error " + layeredError;
        if (blur != null && layered != null) return blur + ", " + layered;
        return blur ?? layered;
    }
}
