using System;

// The page may animate only while the window is shown and the session is unlocked. Each setter returns true
// when that combined state flipped; the caller then sends visibility {visible: Running} and pauses or resumes
// the hit poll.
public class PauseGate
{
    bool shown;
    bool locked;

    public bool Running { get { return shown && !locked; } }

    public bool SetShown(bool value)
    {
        bool was = Running;
        shown = value;
        return was != Running;
    }

    public bool SetLocked(bool value)
    {
        bool was = Running;
        locked = value;
        return was != Running;
    }
}
