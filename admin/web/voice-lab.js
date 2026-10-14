// Reachmark Admin — private voice-cloning lab UI.
// Deliberately refuses to fall back to /api/studio/match: that endpoint only matches
// pitch/rate to a Piper preset and is not genuine voice cloning.
'use strict';
PAGES['voice-lab'] = 'Private Voice Lab';

VIEWS['voice-lab'] = async el => {
  el.innerHTML = `
    <section class="vl-head">
      <div>
        <div class="vl-eyebrow">Experimental audio workspace · admin only</div>
        <h1 class="vl-title">Voice Lab</h1>
        <p class="vl-sub">Test a real cloned voice, tune expressive delivery, then verify how your agent sounds before any customer-facing release.</p>
      </div>
      <div class="vl-status"><span id="vl-led" class="led off"></span><span id="vl-status-text">Checking clone worker…</span></div>
    </section>
    <div id="vl-worker-warning" class="vl-notice vl-blocked" role="status">
      <strong>Real cloning engine not connected yet.</strong>
      This workspace will not label a pitch-matched Piper preset as a clone. Connect the private GPU/voice worker before processing a sample. Delivery presets currently adjust phrasing and pace; they are not full emotional acting controls.
    </div>
    <div class="vl-layout" style="margin-top:14px">
      <section class="vl-panel">
        <h3>01 / Create a voice profile</h3>
        <label class="vl-field">Voice profile name
          <input id="vl-name" maxlength="60" placeholder="e.g. Ernest — conversational">
        </label>
        <label class="vl-drop" for="vl-sample">
          <strong id="vl-file-name">Choose a clean voice sample</strong>
          <small>PCM WAV only · 10–30 seconds · one speaker · quiet room</small>
          <input id="vl-sample" type="file" accept=".wav,audio/wav,audio/x-wav">
        </label>
        <label class="vl-field">Voice notes (optional)
          <input id="vl-notes" maxlength="200" placeholder="Warm, clear, low-key…">
        </label>
        <label class="vl-field" style="display:flex;align-items:flex-start;gap:9px;color:var(--dim)">
          <input id="vl-consent" type="checkbox" style="width:auto;margin-top:3px">
          <span>I own this voice or have explicit permission to clone it. I will not clone someone deceptively.</span>
        </label>
        <button id="vl-clone" class="btn primary block" disabled>Clone voice — waiting for worker</button>
        <div class="vl-foot">Private admin test only. Samples must be handled securely and deletable. Do not upload another person's voice without permission.</div>
      </section>
      <section class="vl-panel">
        <h3>02 / Expressive speech test</h3>
        <label class="vl-field">Select a saved clone
          <select id="vl-voice" disabled><option value="">Clone worker not connected</option></select>
        </label>
        <label class="vl-field">Test phrase
          <textarea id="vl-text" maxlength="1200">Hey, it's good to hear from you. Give me a second to check that, and I'll walk you through it.</textarea>
        </label>
        <div class="vl-agent-test">
          <div class="vl-eyebrow">Optional · test a real agent reply</div>
          <label class="vl-field">Your admin workspace agent
            <select id="vl-agent"><option value="">Loading your agents…</option></select>
          </label>
          <label class="vl-field">Message to the agent
            <textarea id="vl-agent-message" maxlength="1200">Can you explain what you can help me with in a friendly, natural way?</textarea>
          </label>
          <button id="vl-agent-speak" class="btn block" disabled>Ask agent and speak the reply</button>
          <p id="vl-agent-reply" class="vl-foot" aria-live="polite">Choose an agent to test its personality and knowledge using your selected clone.</p>
        </div>
        <div class="grid g2">
          <label class="vl-field">Delivery style
            <select id="vl-style" disabled>
              <option value="conversational">Conversational</option>
              <option value="warm">Warm &amp; reassuring</option>
              <option value="excited">Excited</option>
              <option value="empathetic">Empathetic</option>
              <option value="calm">Calm &amp; measured</option>
            </select>
          </label>
          <label class="vl-field">Pacing
            <select id="vl-pacing" disabled>
              <option value="natural">Natural</option><option value="measured">Measured</option><option value="brisk">Brisk</option>
            </select>
          </label>
        </div>
        <button id="vl-generate" class="btn primary block" disabled>Generate expressive sample</button>
        <div id="vl-audio-wrap" class="hidden"><audio id="vl-audio" class="vl-audio" controls></audio></div>
        <p id="vl-result" class="vl-foot" aria-live="polite">Audio generation becomes available after a real cloning worker is connected.</p>
      </section>
    </div>
    <section class="vl-panel" style="margin-top:14px">
      <h3>03 / Agent verification checklist</h3>
      <div class="vl-steps">
        <div class="vl-step"><span class="vl-step-n">01</span><div><b>Voice identity</b><p>Compare a neutral sentence with the reference recording; do not rely on pitch similarity alone.</p></div></div>
        <div class="vl-step"><span class="vl-step-n">02</span><div><b>Expression and naturalness</b><p>Listen for natural pauses, emphasis, sentence melody and emotional tone without robotic jumps.</p></div></div>
        <div class="vl-step"><span class="vl-step-n">03</span><div><b>Agent response</b><p>After speech quality passes, bind the saved clone to an agent and test multiple replies—not just a single preset phrase.</p></div></div>
      </div>
      <div class="vl-chiprow" style="margin-top:14px"><span class="vl-chip">No paid API key required by design</span><span class="vl-chip">GPU worker preferred</span><span class="vl-chip">Admin-only testing</span><span class="vl-chip">No fake clone fallback</span></div>
    </section>`;

  const led = el.querySelector('#vl-led');
  const statusText = el.querySelector('#vl-status-text');
  const warning = el.querySelector('#vl-worker-warning');
  const cloneBtn = el.querySelector('#vl-clone');
  const generateBtn = el.querySelector('#vl-generate');
  const fileInput = el.querySelector('#vl-sample');
  const consent = el.querySelector('#vl-consent');
  const voiceSelect = el.querySelector('#vl-voice');
  const result = el.querySelector('#vl-result');
  const agentSelect = el.querySelector('#vl-agent');
  const agentMessage = el.querySelector('#vl-agent-message');
  const agentSpeak = el.querySelector('#vl-agent-speak');
  const agentReply = el.querySelector('#vl-agent-reply');
  let workerReady = false;
  let profiles = [];
  let agents = [];

  const refreshEnabled = () => {
    cloneBtn.disabled = !workerReady || !fileInput.files.length || !consent.checked;
    generateBtn.disabled = !workerReady || !voiceSelect.value || !el.querySelector('#vl-text').value.trim();
    agentSpeak.disabled = !workerReady || !voiceSelect.value || !agentSelect.value || !agentMessage.value.trim();
  };
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    el.querySelector('#vl-file-name').textContent = f ? f.name + ' · ' + (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'Choose a clean voice sample';
    refreshEnabled();
  });
  consent.addEventListener('change', refreshEnabled);
  voiceSelect.addEventListener('change', refreshEnabled);
  el.querySelector('#vl-text').addEventListener('input', refreshEnabled);

  // The backend status route is intentionally a hard requirement. Until it is implemented
  // and authenticated, this page stays safely disabled rather than using the fake-match API.
  try {
    const s = await api('/api/voice-lab/status');
    workerReady = !!(s && s.ready === true && s.authenticated === true);
    if (workerReady) {
      led.className = 'led on';
      statusText.textContent = 'Clone worker ready';
      warning.classList.add('hidden');
      profiles = Array.isArray(s.voices) ? s.voices : [];
      voiceSelect.innerHTML = '<option value="">Choose a saved clone…</option>' + profiles.map(v => '<option value="' + esc(v.id) + '">' + esc(v.name || v.id) + '</option>').join('');
      voiceSelect.disabled = false;
      el.querySelector('#vl-style').disabled = false;
      el.querySelector('#vl-pacing').disabled = false;
      result.textContent = 'Worker is ready. Create or select a voice profile to begin.';
    } else {
      led.className = 'led off';
      statusText.textContent = 'Clone worker unavailable';
    }
  } catch {
    led.className = 'led off';
    statusText.textContent = 'Clone worker not connected';
    result.textContent = 'No clone-worker endpoint is available yet. No sample has been uploaded or processed.';
  }
  refreshEnabled();

  cloneBtn.addEventListener('click', async () => {
    const f = fileInput.files[0];
    if (!f || !consent.checked || !workerReady) return;
    if (f.size > 20 * 1024 * 1024) { toast('Sample must be 20 MB or smaller.', true); return; }
    cloneBtn.disabled = true;
    result.textContent = 'Preparing secure upload…';
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read sample.'));
        reader.readAsDataURL(f);
      });
      const j = await api('/api/voice-lab/clone', { name: el.querySelector('#vl-name').value.trim(), notes: el.querySelector('#vl-notes').value.trim(), sample: dataUrl, consent: true });
      if (!j.voice || !j.voice.id) throw new Error('Worker did not return a saved voice profile.');
      profiles = [j.voice, ...profiles.filter(v => v.id !== j.voice.id)];
      voiceSelect.innerHTML = '<option value="">Choose a saved clone…</option>' + profiles.map(v => '<option value="' + esc(v.id) + '">' + esc(v.name || v.id) + '</option>').join('');
      voiceSelect.value = j.voice.id;
      result.textContent = 'Voice profile created. Generate a few samples and compare identity and expression.';
      toast('Voice profile created.');
    } catch (e) { result.textContent = e.message; toast(e.message, true); }
    finally { refreshEnabled(); }
  });

  agentSpeak.addEventListener('click', async () => {
    if (!workerReady || !voiceSelect.value || !agentSelect.value) return;
    agentSpeak.disabled = true;
    agentReply.textContent = 'Asking the agent…';
    try {
      const answer = await api('/api/studio/chat', {
        agentId: agentSelect.value,
        message: agentMessage.value.trim(),
        history: []
      });
      const reply = String(answer.content || '').trim();
      if (!reply) throw new Error('The agent returned an empty reply.');
      agentReply.textContent = 'Agent reply: ' + reply;
      const spoken = await api('/api/voice-lab/synthesize', {
        voiceId: voiceSelect.value,
        text: reply,
        style: el.querySelector('#vl-style').value,
        pacing: el.querySelector('#vl-pacing').value
      });
      if (!spoken.audioUrl) throw new Error('Worker did not return an audio URL.');
      const audio = el.querySelector('#vl-audio');
      audio.src = spoken.audioUrl;
      el.querySelector('#vl-audio-wrap').classList.remove('hidden');
      result.textContent = 'Agent reply generated and spoken using the selected cloned voice.';
      audio.play().catch(() => {});
    } catch (e) {
      agentReply.textContent = e.message;
      toast(e.message, true);
    } finally { refreshEnabled(); }
  });

  generateBtn.addEventListener('click', async () => {
    if (!workerReady || !voiceSelect.value) return;
    generateBtn.disabled = true;
    result.textContent = 'Generating expressive speech…';
    try {
      const j = await api('/api/voice-lab/synthesize', {
        voiceId: voiceSelect.value,
        text: el.querySelector('#vl-text').value.trim(),
        style: el.querySelector('#vl-style').value,
        pacing: el.querySelector('#vl-pacing').value
      });
      if (!j.audioUrl) throw new Error('Worker did not return an audio URL.');
      const audio = el.querySelector('#vl-audio');
      audio.src = j.audioUrl;
      el.querySelector('#vl-audio-wrap').classList.remove('hidden');
      result.textContent = 'Sample generated. Listen for voice similarity, natural pauses and emotional consistency.';
      audio.play().catch(() => {});
    } catch (e) { result.textContent = e.message; toast(e.message, true); }
    finally { refreshEnabled(); }
  });
};
