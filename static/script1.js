async function generatePDF(updatedText, rankedResults) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Page settings
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const marginX = 20;
    const marginY = 30;
    let y = marginY;

    // Title
    // Title with proper line breaking
    const dictionaryKeys = Object.keys(rankedResults).join(", ");
    const title = `Topics - ${dictionaryKeys}`;

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");

    // Ensure proper word wrapping within the page width
    const titleLines = pdf.splitTextToSize(title, pageWidth - 2 * marginX);
    titleLines.forEach(line => {
        pdf.text(line, marginX, y);
        y += 10; // Move down for next line
    });

    // Ensure there's enough spacing before starting normal text
    y += 5;


    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    // Helper function to create clickable links
    const drawUnderlinedLink = (text, x, y, url) => {
        pdf.setTextColor(0, 0, 255); // Blue for links
        pdf.textWithLink(text, x, y, { url });
        const textWidth = pdf.getTextWidth(text);

        // Draw underline
        pdf.setDrawColor(0, 0, 255);
        pdf.line(x, y + 1, x + textWidth, y + 1);

        pdf.setTextColor(0, 0, 0); // Reset text color
        pdf.setDrawColor(0, 0, 0); // Reset line color
        return textWidth;
    };

    // Split the input text into paragraphs
    const paragraphs = updatedText.split("\n\n");

    for (const paragraph of paragraphs) {
        let words = paragraph.split(/(\*\*.*?\*\*)|\s+/).filter(Boolean);
        let x = marginX;

        for (const word of words) {
            const isKeyword = word.startsWith("**") && word.endsWith("**");
            const cleanWord = isKeyword ? word.slice(2, -2) : word;
            const wordWidth = pdf.getTextWidth(cleanWord) + pdf.getTextWidth(" ");

            // Move to the next line if width exceeds max width
            if (x + wordWidth > pageWidth - marginX) {
                y += 8;
                x = marginX;

                if (y > pageHeight - 20) {
                    pdf.addPage();
                    y = marginY;
                }
            }

            if (isKeyword && rankedResults[cleanWord]) {
                const url = rankedResults[cleanWord].url;
                x += drawUnderlinedLink(cleanWord, x, y, url) + pdf.getTextWidth(" ");
            } else {
                pdf.text(cleanWord, x, y);
                x += wordWidth;
            }
        }

        y += 8;

        if (y > pageHeight - 20) {
            pdf.addPage();
            y = marginY;
        }
    }

    // Convert to blob and send to backend
    const pdfBlob = pdf.output('blob');
    const formData = new FormData();
    formData.append("pdf", pdfBlob, "lecture_notes_with_links.pdf");

    try {
        const response = await fetch('http://localhost:8080/save_pdf', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.file_path) {
            // Show the PDF in an iframe or open it in a new window
            const pdfViewer = document.getElementById('pdfViewer');
            pdfViewer.src = `http://localhost:8080/download_pdf?filename=${result.filename}`;
            pdfViewer.style.display = 'block';
        } else {
            alert("Failed to save PDF.");
        }
    } catch (err) {
        console.error("Error saving PDF:", err);
        alert("Error saving PDF. Check console for details.");
    }
}

// Function to call the API and generate PDF
function processTextAndGeneratePDF() {
    fetch('http://localhost:8080/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalRecognizedText })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to process text: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        const updatedText = data.processed_text;
        const rankedResults = data.ranked_results;

        // Generate and display the PDF
        generatePDF(updatedText, rankedResults);
    })
    .catch(error => {
        console.error("Error processing text:", error);
        alert("Error processing text. Check console for details.");
    });
}

// Attach PDF generation to the button
document.getElementById("generatePdfButton").addEventListener("click", processTextAndGeneratePDF);

document.getElementById("generatePdfButton").addEventListener("click", function () {
  const pdfContainer = document.getElementById("pdfContainer");
  const pdfViewer = document.getElementById("pdfViewer");
  const loadingMessage = document.getElementById("pdfLoadingMessage");

  // Show the container and loading message
  pdfContainer.style.display = "block";
  loadingMessage.style.display = "block";

  // Scroll to the container
  pdfContainer.scrollIntoView({ behavior: "smooth" });

  // Once PDF is loaded, hide loading message
  pdfViewer.onload = function () {
    loadingMessage.style.display = "none";
  };
});
  

document.getElementById('mcqButton').addEventListener('click', () => {
    window.location.href = "http://localhost:5500";
});

