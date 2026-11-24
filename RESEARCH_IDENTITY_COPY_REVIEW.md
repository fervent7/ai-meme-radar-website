# Mobile token and pool identity actions

Review parenta098a88d4a64878541c9cd6ce2046aeb7b3249d4; PR3. No deployment.

The actual research cards now offer48px Copy token address / Copy pool address
controls. Full identities remain visible/selectable; Solana case is preserved.
An in-flight copy disables repeated taps; success is announced only after the
clipboard resolves. Clipboard denial or missing support gives a safe manual
selection instruction and restores retry. No private exception details, external
navigation, market request or trading action is triggered. Invalid address/network
formats do not get a copy action. Existing black/emerald styles are reused.

68 Node tests passed locally, including deferred success/double-tap and denied/
unavailable clipboard recovery. The existing responsive suite now tests exact
full token/pool copying, denied clipboard recovery,48px targets and no overflow
at390px alongside all existing10 viewport/six route checks. Local browser execution
was blocked: cached Chromium binary absent and browser download returnedHTTP403;
installation retries were stopped. Exact-head GitHub browser CI must establish
PASS before claiming responsive verification. No physical Android or hosted
revision verification claimed. UI fixtures remain explicit test data.
