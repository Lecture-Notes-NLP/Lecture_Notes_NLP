// ===========================================
// CREATE COURSE BY TEACHER
// ===========================================

// document.addEventListener('DOMContentLoaded', () => {
//     const form = document.getElementById('courseForm');

//     if (form) {
//         form.addEventListener('submit', function(event) {
//             event.preventDefault();

//             const title = document.getElementById('courseTitle').value;
//             const description = document.getElementById('courseDesc').value;
//             const access = document.getElementById('giveAccess').value;

//             if (title && description && access) {
//                 const coursesContainer = document.getElementById('coursesContainer');

//                 const courseCard = document.createElement('div');
//                 courseCard.classList.add('col-lg-4', 'col-md-6', 'mb-4');
//                 courseCard.innerHTML = `
//                     <div class="card course-card">
//                         <div class="card-body">
//                             <h5 class="card-title">${title}</h5>
//                             <p class="card-text">${description}</p>
//                             <a href="course.html" class="btn btn-primary btn-sm">View Course</a>
//                         </div>
//                     </div>
//                 `;

//                 coursesContainer.appendChild(courseCard);

//                 // Clear form fields
//                 form.reset();

//                 // Close the modal
//                 $('#createCourseModal').modal('hide');
//             }
//         });
//     }
// });

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('courseForm');

    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();

            const title = document.getElementById('courseTitle').value;
            const description = document.getElementById('courseDesc').value;
            const access = document.getElementById('giveAccess').value;

            if (title && description && access) {
                const coursesContainer = document.getElementById('coursesContainer');

                // Create course card in the same format
                const courseCard = document.createElement('div');
                courseCard.classList.add('card', 'mb-4');

                courseCard.innerHTML = `
                    <div class="card-header">
                        <div>
                            <h5>${title}</h5>
                        </div>
                    </div>

                    <div class="card-body">
                        <!-- Course Description -->
                        <p class="course-description">
                            ${description}
                        </p>

                        <!-- Buttons Row -->
                        <div class="d-flex flex-column flex-md-row justify-content-around align-items-center">
                            <a href="#" class="btn btn-primary mb-2 mb-md-0">Record</a>
                            <a href="#" class="btn btn-secondary mb-2 mb-md-0">View Previous Notes</a>
                            <a href="#" class="btn btn-success">View Students</a>
                        </div>
                    </div>
                `;

                // Append the new course card to the container
                coursesContainer.appendChild(courseCard);

                // Clear form fields
                form.reset();

                // Close the modal
                $('#createCourseModal').modal('hide');
            }
        });
    }
});

  


// ===========================================
// RECORD JS
// ===========================================

const recordBtn = document.getElementById('record-btn');
const recordingStatus = document.getElementById('recording-status');
const transcript = document.getElementById('transcript');
let recognition;
let isRecording = false;

window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (recordBtn && recordingStatus && transcript) {
    if (!window.SpeechRecognition) {
        alert("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
    } else {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            recordingStatus.style.visibility = 'visible';
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
            recordBtn.classList.remove('btn-primary');
            recordBtn.classList.add('btn-danger');
        };

        recognition.onend = () => {
            recordingStatus.style.visibility = 'hidden';
            isRecording = false;
            recordBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
            recordBtn.classList.remove('btn-danger');
            recordBtn.classList.add('btn-primary');

            const modalTrigger = document.createElement('button');
            modalTrigger.setAttribute('data-bs-toggle', 'modal');
            modalTrigger.setAttribute('data-bs-target', '#saveModal');
            modalTrigger.style.display = 'none';
            document.body.appendChild(modalTrigger);
            modalTrigger.click();
            modalTrigger.remove();
        };

        recognition.onresult = (event) => {
            let text = '';
            for (let i = 0; i < event.results.length; i++) {
                text += event.results[i][0].transcript;
            }
            transcript.value = text;
        };

        recordBtn.addEventListener('click', () => {
            if (!isRecording) {
                recognition.start();
                isRecording = true;
            } else {
                recognition.stop();
            }
        });
    }
}

// Close modal when clicking on data-dismiss buttons
document.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
        $('#saveModal').modal('hide');
    });
});

// redirect for quiz and record
function redirectToPort(port) {
    const hostname = window.location.hostname;  // Get current hostname (localhost or IP)
    window.location.href = `http://${hostname}:${port}`;
}

// 



// ===========================================
// LOGOUT JS
// ===========================================

function logout() {
    // Perform any cleanup actions here (e.g., clearing local storage, etc.)
    
    // Redirect to the home page
    window.location.href = "../home.html";
}

    // function logout() {
    //     localStorage.removeItem("userType");  // Clear user session
    //     window.location.href = "login.html";  // Redirect to login
    // }



    function redirectToDashboard(event) {
        event.preventDefault();  // Prevent form submission
        const userType = document.getElementById('userType').value;

        // Store user type in localStorage
        localStorage.setItem("userType", userType);

        // Redirect based on user type
        if (userType === 'teacher') {
            window.location.href = 'teacher_dashboard.html';
        } else {
            window.location.href = 'student_dashboard.html';
        }
    }


// ===========================================
// QUIZ JS
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    const quizForm = document.getElementById('mcqForm');

    if (quizForm) {
        quizForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const answers = {
                q1: 'b',  
                q2: 'a',
                q3: 'b', 
            };

            let score = 0;

            for (const [question, correctAnswer] of Object.entries(answers)) {
                const selected = document.querySelector(`input[name="${question}"]:checked`);
                if (selected && selected.value === correctAnswer) {
                    score++;
                }
            }

            const totalQuestions = Object.keys(answers).length;
            const resultText = `You scored ${score} out of ${totalQuestions}`;

            const scoreResult = document.getElementById('scoreResult');
            
            if (scoreResult) {
                scoreResult.innerText = resultText;

                // Show Modal
                $('#scoreModal').modal('show');
            }
        });
    }
});

