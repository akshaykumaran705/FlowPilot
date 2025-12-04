(async () => {
  const base = 'http://localhost:4000';
  const headers = { 'Content-Type': 'application/json' };

  const buggyCode = `function sum(arr) {\n  let s = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    s += arr[i];\n  }\n  return s;\n}`;
  const fixedCode = `function sum(arr) {\n  let s = 0;\n  for (let i = 0; i < arr.length; i++) {\n    s += arr[i];\n  }\n  return s;\n}`;

  try {
    console.log('Creating local task...');
    let res = await fetch(`${base}/api/tasks/local`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Bug: incorrect sum function',
        description: 'Off-by-one bug when summing array elements',
        labels: ['local', 'bug'],
      }),
    });
    const task = await res.json();
    console.log('Task created:', JSON.stringify(task, null, 2));
    const taskId = task.id;
    if (!taskId) throw new Error('No task id returned');

    console.log('\nStarting session...');
    res = await fetch(`${base}/api/session/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ taskId, source: 'LOCAL' }),
    });
    const session = await res.json();
    console.log('Session started:', JSON.stringify(session, null, 2));
    const sessionId = session.id;
    if (!sessionId) throw new Error('No session id returned');

    const postEvent = async (type, payload) => {
      const r = await fetch(`${base}/api/session/event`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, type, payload }),
      });
      return r.ok;
    };

    console.log('\nPosting events (buggy code + failing test)...');
    await postEvent('NOTE', { kind: 'CODE_SNIPPET', language: 'javascript', content: buggyCode });
    await postEvent('TEST_RESULT', { testName: 'sum should add array elements', status: 'fail', output: 'TypeError or NaN observed' });

    console.log('Posting events (fixed code + passing test)...');
    await postEvent('NOTE', { kind: 'CODE_SNIPPET', language: 'javascript', content: fixedCode });
    await postEvent('TEST_RESULT', { testName: 'sum should add array elements', status: 'pass', output: 'All tests passed' });

    console.log('\nEnding session (triggers summarization)...');
    res = await fetch(`${base}/api/session/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId }),
    });
    const endResp = await res.json();
    console.log('Session end response:', JSON.stringify(endResp, null, 2));

    console.log('\nFetching final session details...');
    res = await fetch(`${base}/api/sessions/${sessionId}`);
    const final = await res.json();
    console.log('Final session detail:', JSON.stringify(final, null, 2));

    if (final && final.session && final.session.summary) {
      console.log('\nSummary:\n', final.session.summary);
    } else if (endResp && endResp.summary) {
      console.log('\nSummary (end response):\n', endResp.summary);
    } else {
      console.log('\nNo summary found in response.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during demo flow:', err);
    process.exit(1);
  }
})();
