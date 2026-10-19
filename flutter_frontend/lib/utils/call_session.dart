/// Ignore delayed events from a previous call, even with the same partner.
bool matchesCallSession(Map<dynamic, dynamic> event, String? callId) =>
    callId == null || event['callId'] == null || event['callId'].toString() == callId;
