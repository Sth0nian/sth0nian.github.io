// Speech lab: synthesis with system voices, and speech recognition
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);

  // Text to speech
  const synth = window.speechSynthesis;
  let voices = [];

  function loadVoices() {
    voices = synth.getVoices();
    if (!voices.length) return;
    const lang = navigator.language;
    voices.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
    $('voice').innerHTML = voices.map((voice, i) =>
      '<option value="' + i + '"' + (voice.default || voice.lang === lang ? ' selected' : '') + '>' +
      Lab.escape(voice.name + ' (' + voice.lang + ')' + (voice.localService ? '' : ' · network')) + '</option>'
    ).join('');
    Lab.setStatus($('ttsStatus'), 'yes', voices.length + ' voices');
  }

  if (synth) {
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    ['rate', 'pitch'].forEach(id => {
      $(id).addEventListener('input', () => { $(id + 'Value').textContent = $(id).value; });
    });

    $('speak').addEventListener('click', () => {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance($('ttsText').value);
      const voice = voices[Number($('voice').value)];
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = Number($('rate').value);
      utterance.pitch = Number($('pitch').value);
      utterance.onstart = () => log('Speaking with ' + (voice ? voice.name : 'the default voice'), 'ok');
      utterance.onend = () => log('Finished speaking');
      utterance.onerror = event => log('Speech error: ' + event.error, 'error');
      synth.speak(utterance);
    });
    $('pause').addEventListener('click', () => synth.pause());
    $('resume').addEventListener('click', () => synth.resume());
    $('cancel').addEventListener('click', () => synth.cancel());
  } else {
    Lab.setStatus($('ttsStatus'), 'no');
    ['speak', 'pause', 'resume', 'cancel'].forEach(id => { $(id).disabled = true; });
  }

  // Speech to text
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let finalText = '';

  if (!Recognition) {
    Lab.setStatus($('sttStatus'), 'no');
    $('listen').disabled = true;
    return;
  }
  Lab.setStatus($('sttStatus'), 'yes', window.SpeechRecognition ? 'Ready' : 'Ready (webkit)');

  $('listen').addEventListener('click', () => {
    recognition = new Recognition();
    recognition.lang = $('sttLang').value;
    recognition.continuous = true;
    recognition.interimResults = $('interim').checked;
    finalText = '';

    recognition.onstart = () => {
      log('Listening in ' + recognition.lang, 'ok');
      Lab.setStatus($('sttStatus'), 'no', '● Listening');
      $('listen').disabled = true;
      $('stopListening').disabled = false;
    };
    recognition.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + ' ';
          log('Heard "' + result[0].transcript.trim() + '" (confidence ' + (result[0].confidence * 100).toFixed(0) + '%)');
        } else {
          interim += result[0].transcript;
        }
      }
      $('transcript').textContent = (finalText + interim).trim() || '…';
    };
    recognition.onerror = event => log('Recognition error: ' + event.error + (event.message ? ' ' + event.message : ''), 'error');
    recognition.onend = () => {
      log('Stopped listening');
      Lab.setStatus($('sttStatus'), 'yes', 'Ready');
      $('listen').disabled = false;
      $('stopListening').disabled = true;
    };

    try {
      recognition.start();
    } catch (error) {
      log('Could not start: ' + error.message, 'error');
    }
  });

  $('stopListening').addEventListener('click', () => recognition && recognition.stop());
})();
