// Global variable to store final recognized text
let finalRecognizedText = "";

function startRecording() {
  fetch('/start', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      document.getElementById('recognizedText').innerText = data.message;
      document.getElementById('finalText').innerText = ""; // Clear final text on start
      finalRecognizedText = "";
      document.getElementById('punctuatedText').innerText = ""; // Clear processed output on start
      document.getElementById('keyPhrasesBox').innerText = "";
      document.getElementById('rankedResultsBox').innerText = "";
      document.getElementById('recording-status').style.visibility = 'visible';
    });
}

function stopRecording() {
  document.getElementById('finalText').innerText = "Processing final recognized text...";
  fetch('/stop', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      finalRecognizedText = data.recognized_text;
      document.getElementById('recording-status').style.visibility = 'hidden';
      document.getElementById('finalText').innerText = finalRecognizedText;
    });
}


function generateKeywords() {
  if (!finalRecognizedText) {
    alert("No final recognized text available.");
    return;
  }

  // Show loading message and hide results container
  document.getElementById('resultsLoading').style.display = 'block';
  document.getElementById('resultsContainer').style.display = 'none';

  fetch('http://localhost:8080/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: finalRecognizedText })
  })
  .then(response => response.json())
  .then(data => {
    // Hide loading and show results
    document.getElementById('resultsLoading').style.display = 'none';
    document.getElementById('resultsContainer').style.display = 'block';

    // Punctuated text
    document.getElementById('punctuatedText').innerText = data.original_text || "No punctuated text available.";

    // Key phrases
    const keyPhrasesBox = document.getElementById('keyPhrasesBox');
    if (data.key_phrases.length > 0) {
      keyPhrasesBox.innerHTML = "<ul>" + data.key_phrases.map(p => `<li>${p}</li>`).join('') + "</ul>";
    } else {
      keyPhrasesBox.innerText = "No key-phrase detected.";
    }

    // Ranked results
    const rankedBox = document.getElementById('rankedResultsBox');
    if (Object.keys(data.ranked_results).length > 0) {
      let resultHTML = "<ul>";
      for (let key in data.ranked_results) {
        const result = data.ranked_results[key];
        resultHTML += `<li><strong>${key}</strong>: <a href="${result.url}" target="_blank">${result.url}</a> (Score: ${result.score})</li>`;
      }
      resultHTML += "</ul>";
      rankedBox.innerHTML = resultHTML;
    } else {
      rankedBox.innerText = "No ranked results found.";
    }
  })
  .catch(err => {
    console.error(err);
    alert("Error processing text");
    document.getElementById('resultsLoading').style.display = 'none';
  });
}



// Poll for recognized text updates every 5 seconds
setInterval(() => {
  fetch('/recognized_text')
    .then(response => response.json())
    .then(data => {
      document.getElementById('recognizedText').innerText = "Recognized Text: " + data.text;
    });
}, 5000);