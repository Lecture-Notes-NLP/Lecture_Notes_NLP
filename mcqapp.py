from flask import Flask, render_template, request, jsonify
import os
import fitz  # PyMuPDF for PDF extraction
import re
import random
import yake
import spacy
import nltk
from nltk.corpus import wordnet
from nltk.tokenize import sent_tokenize
from nltk.stem import WordNetLemmatizer
from werkzeug.utils import secure_filename
from dbms_keywords import dbms_keywords  # Import DBMS keywords

# Initialize NLP models
# nltk.download('punkt')
# nltk.download('punkt_tab')
# nltk.download('wordnet')
# nltk.download('omw-1.4')

# spacy.cli.download("en_core_web_sm")
nlp = spacy.load("en_core_web_sm")

from flask_cors import CORS

app = Flask(__name__)
CORS(app)

lemmatizer = WordNetLemmatizer()

# Store correct answers for evaluation
mcq_answers = {}

# Define the fixed PDF file path
PDF_PATH = os.path.expanduser("~/Desktop/Lecture_Notes/lecture_notes_with_links.pdf")

# Extract text from PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text += page.get_text("text") + "\n"
    return text.strip()

# Preprocess text
def preprocess_text(text):
    text = re.sub(r'\s+', ' ', text).strip()
    return sent_tokenize(text)

# Extract keyphrases
def extract_keywords(text, num_keywords=1):
    kw_extractor = yake.KeywordExtractor(n=2, dedupLim=0.9, top=num_keywords)
    keywords = kw_extractor.extract_keywords(text)
    return [kw[0] for kw in keywords]

# Find relevant sublist in dbms_keywords
def find_relevant_sublist(word):
    for category, words in dbms_keywords.items():
        if any(w.lower() in word.lower() or word.lower() in w.lower() for w in words):
            return words
    return None

# Generate distractors
def get_distractors(word, num_distractors=3):
    base_word = lemmatizer.lemmatize(word)
    synonyms = wordnet.synsets(base_word)
    distractors = set()

    for syn in synonyms:
        for lemma in syn.lemmas():
            if lemma.name().lower() != base_word.lower():
                distractors.add(lemma.name().replace("_", " "))

    distractors = list(distractors)

    if len(distractors) < num_distractors:
        relevant_sublist = find_relevant_sublist(base_word)
        if relevant_sublist:
            additional_options = [w for w in relevant_sublist if w.lower() != base_word.lower()]
            random.shuffle(additional_options)
            distractors.extend(additional_options[:num_distractors - len(distractors)])

    if len(distractors) < num_distractors:
        fallback_options = dbms_keywords["General DBMS Terms"]
        additional_options = [w for w in fallback_options if w.lower() != base_word.lower()]
        random.shuffle(additional_options)
        distractors.extend(additional_options[:num_distractors - len(distractors)])

    return distractors[:num_distractors]

# Generate MCQs
def generate_mcqs(text, num_questions=5):
    sentences = preprocess_text(text)
    mcqs = []
    global mcq_answers
    mcq_answers = {}

    for i, sentence in enumerate(sentences):
        if len(mcqs) >= num_questions:
            break

        keywords = extract_keywords(sentence, num_keywords=1)
        for keyword in keywords:
            question = sentence.replace(keyword, "______")
            distractors = get_distractors(keyword)

            # Capitalize the first letter of each option
            options = [keyword.capitalize()] + [d.capitalize() for d in distractors]
            random.shuffle(options)

            mcqs.append({"id": i, "question": question, "options": options})
            mcq_answers[i] = keyword  

    return mcqs

# Flask Routes
@app.route("/")
def index():
    return render_template("mcqindex.html")

@app.route("/generate_mcq", methods=["GET"])
def generate_mcq():
    if not os.path.exists(PDF_PATH):
        return jsonify({"error": "The file testing.pdf was not found in Desktop/Lecture_Notes."})

    text = extract_text_from_pdf(PDF_PATH)
    mcqs = generate_mcqs(text, num_questions=5)

    return jsonify(mcqs)

@app.route('/submit_quiz', methods=['POST'])
def submit_quiz():
    user_answers = request.get_json()
    score = 0
    total = len(mcq_answers)

    for qid_str, user_answer in user_answers.items():
        qid = int(qid_str)
        correct_answer = mcq_answers.get(qid)

        if correct_answer and user_answer.strip().lower() == correct_answer.strip().lower():
            score += 1

    return jsonify({"score": score, "total": total})

if __name__ == "__main__":
    app.run(debug=True, port=5500)  # Run on a different port
