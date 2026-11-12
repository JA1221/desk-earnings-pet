window.QJZ = window.QJZ || {};
QJZ.day = (function () {
  function copy(rec, changes) {
    var o = {};
    for (var k in rec) if (Object.prototype.hasOwnProperty.call(rec, k)) o[k] = rec[k];
    for (var c in changes) if (Object.prototype.hasOwnProperty.call(changes, c)) o[c] = changes[c];
    return o;
  }

  function empty(day) {
    return {
      day: day, startMs: null, startSource: null, adjusted: false,
      endMs: null, endSource: null, lastLockMs: null,
      offDay: false, snacksEaten: 0, earned: null
    };
  }

  function indexOf(arr, v) {
    if (!arr) return -1;
    for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
    return -1;
  }

  // logon / unlock / resume / appstart / probe: the first one of a working day starts it.
  function onActivity(rec, ev, settings) {
    var changes = { lastLockMs: null };
    if (rec.startMs === null && !rec.offDay && settings.startMode === 'auto' &&
        indexOf(settings.workDays, QJZ.time.weekday(rec.day)) >= 0) {
      changes.startMs = ev.ms;
      changes.startSource = 'auto';
    }
    return copy(rec, changes);
  }

  // Lock or suspend.
  function onLock(rec, ms) { return copy(rec, { lastLockMs: ms }); }

  // The host's last shutdown / sign-out (init.lastExitMs) counts as a lock of that day's record when it falls on the
  // record's day (QJZ.time.dayKey) after its start, and only while the record has no lock: every logon / unlock /
  // resume / app start clears lastLockMs, so a lock that is still there means the session was already locked or asleep
  // when the app ended (locked at 15:00, restarted by Windows Update at 03:00): that lock is when the user left.
  // Anything else leaves rec as it is.
  function onExit(rec, ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || typeof rec.startMs !== 'number' || !(ms > rec.startMs) ||
        QJZ.time.dayKey(ms) !== rec.day) return rec;
    if (typeof rec.lastLockMs === 'number') return rec;
    return copy(rec, { lastLockMs: ms });
  }

  // 開始上班 is a fresh start: it also ends a 今天休假 and forgets an earlier 下班.
  function manualStart(rec, ms) { return copy(rec, { startMs: ms, startSource: 'manual', offDay: false, endMs: null, endSource: null }); }
  function adjustStart(rec, ms) { return copy(rec, { startMs: ms, adjusted: true }); }
  function manualEnd(rec, ms) { return copy(rec, { endMs: ms, endSource: 'manual' }); }
  // 繼續上班 after a 下班 (a mis-click): the day runs on from its start, the time in between included.
  function resume(rec) { return copy(rec, { endMs: null, endSource: null }); }
  // 今天休假: the day counts 0 (QJZ.earn.snapshot, QJZ.history.closeDay) whatever its start and end; off again, it
  // counts as before.
  function setOffDay(rec, v) { return copy(rec, { offDay: !!v }); }

  // Yesterday's record that ended with a lock before the planned end: ask whether that was the end of the day.
  // Never for an off day (it counts 0 either way).
  function earlyLeaveQuestion(prevRec, settings) {
    if (!prevRec || prevRec.offDay || prevRec.startMs === null || prevRec.endMs !== null || prevRec.lastLockMs === null) return null;
    var planned = QJZ.earn.endAtMs(prevRec.startMs, prevRec.day, settings.hoursPerDay, settings.lunch);
    if (prevRec.lastLockMs < planned) return { day: prevRec.day, lockMs: prevRec.lastLockMs };
    return null;
  }

  // accept: the last lock was the real end of day. Declined: keep it open (planned end applies) and stop asking.
  function resolveEarlyLeave(prevRec, accept) {
    if (accept && prevRec.lastLockMs !== null) return copy(prevRec, { endMs: prevRec.lastLockMs, endSource: 'confirmed' });
    return copy(prevRec, { lastLockMs: null });
  }

  function rollover(rec, nowMs) {
    var key = QJZ.time.dayKey(nowMs);
    if (key > rec.day) return { closed: rec, current: empty(key) };
    return { closed: null, current: rec };
  }

  return {
    empty: empty, onActivity: onActivity, onLock: onLock, onExit: onExit,
    manualStart: manualStart, adjustStart: adjustStart, manualEnd: manualEnd, resume: resume, setOffDay: setOffDay,
    earlyLeaveQuestion: earlyLeaveQuestion, resolveEarlyLeave: resolveEarlyLeave, rollover: rollover
  };
})();
