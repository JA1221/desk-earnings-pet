using System;
using System.Reflection;

public static class Assert
{
    public static void Eq(object expected, object actual, string msg)
    {
        if (!object.Equals(expected, actual))
            throw new Exception(msg + ": expected <" + expected + "> but got <" + actual + ">");
    }
    public static void True(bool cond, string msg)
    {
        if (!cond) throw new Exception(msg);
    }
}

public static class TestRunner
{
    public static int Main()
    {
        int pass = 0, fail = 0;
        foreach (Type t in Assembly.GetExecutingAssembly().GetTypes())
        {
            if (!t.Name.EndsWith("Tests")) continue;
            foreach (MethodInfo m in t.GetMethods(BindingFlags.Public | BindingFlags.Static))
            {
                if (!m.Name.StartsWith("Test_") || m.GetParameters().Length != 0) continue;
                try { m.Invoke(null, null); pass++; }
                catch (TargetInvocationException e)
                {
                    fail++;
                    Console.WriteLine("FAIL " + t.Name + "." + m.Name + ": " + e.InnerException.Message);
                }
            }
        }
        Console.WriteLine("HOST: " + pass + " passed, " + fail + " failed");
        if (pass + fail == 0) { Console.WriteLine("HOST: no tests were discovered"); return 1; }
        return fail == 0 ? 0 : 1;
    }
}
