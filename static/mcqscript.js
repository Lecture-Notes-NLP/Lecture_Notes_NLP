let mcqData = {};

function fetchMCQs() {
    const loading = document.getElementById("loadingMessage");
    const container = document.getElementById("mcqContainer");

    loading.style.display = "block";     // Show loading spinner
    container.innerHTML = "";            // Clear previous content
    mcqData = {};

    fetch("/generate_mcq")
        .then(response => response.json())
        .then(data => {
            loading.style.display = "none";  // Hide spinner

            if (data.error) {
                container.innerHTML = `<p style="color:red;">${data.error}</p>`;
                return;
            }

            const form = document.createElement("form");
            form.id = "mcqForm";

            data.forEach((mcq, index) => {
                mcqData[mcq.id] = "";

                let card = document.createElement("div");
                card.className = "card my-3";

                let header = document.createElement("div");
                header.className = "card-header";
                header.textContent = `${index + 1}. ${mcq.question}`;
                card.appendChild(header);

                let body = document.createElement("div");
                body.className = "card-body";

                mcq.options.forEach((option, optIndex) => {
                    let formCheck = document.createElement("div");
                    formCheck.className = "form-check";

                    let input = document.createElement("input");
                    input.type = "radio";
                    input.name = `q${mcq.id}`;
                    input.value = option;
                    input.className = "form-check-input";
                    input.required = true;
                    input.onchange = () => storeAnswer(mcq.id, option);

                    let label = document.createElement("label");
                    label.className = "form-check-label";
                    label.textContent = `${String.fromCharCode(65 + optIndex)}) ${option}`;

                    formCheck.appendChild(input);
                    formCheck.appendChild(label);
                    body.appendChild(formCheck);
                });

                card.appendChild(body);
                form.appendChild(card);
            });

            let submitDiv = document.createElement("div");
            submitDiv.className = "text-center my-4";

            let submitBtn = document.createElement("button");
            submitBtn.type = "submit";
            submitBtn.className = "btn btn-submit btn-primary";
            submitBtn.textContent = "Submit";
            submitDiv.appendChild(submitBtn);
            form.appendChild(submitDiv);

            form.onsubmit = function (e) {
                e.preventDefault();
                submitQuiz();
            };

            container.appendChild(form);
        })
        .catch(error => {
            loading.innerHTML = "<div class='text-danger'>Failed to load questions.</div>";
            console.error("Error fetching MCQs:", error);
        });
}

function storeAnswer(questionId, answer) {
    mcqData[questionId] = answer;
}

function submitQuiz() {
    fetch("/submit_quiz", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(mcqData)
    })
    .then(response => response.json())
    .then(data => {
        // Show modal with score
        document.getElementById("scoreResult").innerText = `Score: ${data.score} / ${data.total}`;
        $('#scoreModal').modal('show');
    });
}


// Automatically fetch MCQs when the page loads
document.addEventListener("DOMContentLoaded", fetchMCQs);
