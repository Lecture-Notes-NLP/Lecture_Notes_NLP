import os
from flask import Flask, request, jsonify, send_from_directory
from deepmultilingualpunctuation import PunctuationModel
import textacy
import inflect
import re
import requests
from bs4 import BeautifulSoup
import concurrent.futures

# Initialize Flask app
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Initialize models and libraries
model = PunctuationModel()
en = textacy.load_spacy_lang("en_core_web_lg")
p = inflect.engine()

@app.route('/process', methods=['POST'])
def process_text():
    data = request.get_json()
    input_text = data.get('text', '')

    if not input_text:
        return jsonify({'error': 'No input text provided'}), 400

    # 1. Restore punctuation and adjust capitalization
    input_text = model.restore_punctuation(input_text)
    input_text = input_text.replace('-', ' ')
    if input_text:
        input_text = input_text[0].upper() + input_text[1:]
    input_text = re.sub(r'([.?!]\s+)(\w)', lambda m: m.group(1) + m.group(2).upper(), input_text)

    # 2. Extract keywords using SGRank
    doc = textacy.make_spacy_doc(input_text, lang=en)
    total_words = len([token.text for token in doc if not token.is_punct])

    if total_words < 100:
        threshold = 1
    elif total_words < 1000:
        threshold = 20
    else:
        threshold = 100
    max_key_phrases = max(1, total_words // threshold)

    sgrank_phrases = [kps for kps, _ in textacy.extract.keyterms.sgrank(doc, normalize="lemma")]
    key_phrases = list(dict.fromkeys(sgrank_phrases))[:max_key_phrases]

    # 3. Process singular/plural variations of key phrases
    updated_key_phrases = []
    added_phrases = set()
    for key_phrase in key_phrases:
        singular_form = key_phrase
        plural_form = p.plural(key_phrase)
        phrase_variants = re.findall(rf'\b{re.escape(singular_form)}\b|\b{re.escape(plural_form)}\b', input_text, re.IGNORECASE)
        for variant in phrase_variants:
            if variant not in added_phrases:
                updated_key_phrases.append(variant)
                added_phrases.add(variant)
                break

    # Sort key phrases by length (longer phrases first)
    updated_key_phrases = sorted(updated_key_phrases, key=lambda x: len(x.split()), reverse=True)

    # 4. Format key phrases in text: replace first occurrence with a placeholder and then wrap with ** **
    updated_text = input_text
    placeholder_map = {}
    for i, phrase in enumerate(updated_key_phrases):
        placeholder = f"__PLACEHOLDER_{i}__"
        placeholder_map[placeholder] = phrase
        updated_text = re.sub(rf'\b{re.escape(phrase)}\b', placeholder, updated_text, count=1)
    for placeholder, phrase in placeholder_map.items():
        updated_text = updated_text.replace(placeholder, f'**{phrase}**')

    # 5. Web search for key phrases
    ranked_results = {}
    api_key = "****"  # Ensure your environment variable is set with this name
    cse_id = "****"    # Ensure your environment variable is set with this name

    if api_key and cse_id:
        def search_google_cse(query, num_results=5):
            url = "https://www.googleapis.com/customsearch/v1"
            params = {'q': query, 'key': api_key, 'cx': cse_id, 'num': num_results}
            response = requests.get(url, params=params)
            response.raise_for_status()
            results = response.json().get('items', [])
            return [item['link'] for item in results if 'link' in item]

        def fetch_webpage_content(url, timeout=5):
            try:
                response = requests.get(url, timeout=timeout)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                paragraphs = soup.find_all('p')
                text_content = ' '.join([p.get_text() for p in paragraphs])
                return text_content.strip(), soup.find_all('a')
            except requests.exceptions.Timeout:
                print(f"Timeout while fetching {url}.")
                return "No content available.", []
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                return "No content available.", []

        def calculate_ranking_score(content, keywords, references):
            keyword_count = sum(content.lower().count(keyword.lower()) for keyword in keywords)
            content_length = len(content.split())
            references_count = len(references)
            score = (keyword_count * 2) + references_count + (content_length / 100)
            return score

        def process_keyphrase(query):
            print(f"Processing query: {query}")
            webpages = search_google_cse(query, num_results=5)
            results = []
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future_to_url = {executor.submit(fetch_webpage_content, url): url for url in webpages}
                for future in concurrent.futures.as_completed(future_to_url):
                    url = future_to_url[future]
                    try:
                        content, references = future.result()
                        keywords = query.split()
                        score = calculate_ranking_score(content, keywords, references)
                        results.append((url, content, score, references))
                    except Exception as e:
                        print(f"Error processing {url}: {e}")
            results.sort(key=lambda x: x[2], reverse=True)
            if results:
                top_url, _, top_score, _ = results[0]
                return {'query': query, 'url': top_url, 'score': top_score}
            return None

        # Use the list of updated_key_phrases directly as queries
        query_map = {}
        for query in updated_key_phrases:
            normalized_query = query.lower()
            if normalized_query not in query_map:
                query_map[normalized_query] = query

        queries = list(query_map.keys())

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_to_query = {executor.submit(process_keyphrase, query): query for query in queries}
            for future in concurrent.futures.as_completed(future_to_query):
                query = future_to_query[future]
                try:
                    result = future.result()
                    if result:
                        original_query = query_map[query]
                        ranked_results[original_query] = {'url': result['url'], 'score': result['score']}
                except Exception as e:
                    print(f"Error processing keyphrase {query}: {e}")

    # Return the complete result
    return jsonify({
        'original_text': input_text,
        'processed_text': updated_text,
        'key_phrases': updated_key_phrases,
        'ranked_results': ranked_results
    })


# PDF handling
# Path to Lecture_Notes folder created by app.py
DESKTOP_PATH = os.path.join(os.path.expanduser('~'), 'Desktop')
LECTURE_NOTES_DIR = os.path.join(DESKTOP_PATH, 'Lecture_Notes')

@app.route("/save_pdf", methods=["POST"])
def save_pdf():
    if 'pdf' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['pdf']
    if file:
        if not os.path.exists(LECTURE_NOTES_DIR):
            os.makedirs(LECTURE_NOTES_DIR)

        pdf_path = os.path.join(LECTURE_NOTES_DIR, 'lecture_notes_with_links.pdf')
        file.save(pdf_path)

        return jsonify({
            "message": "PDF saved",
            "file_path": pdf_path,
            "filename": "lecture_notes_with_links.pdf"
        })
    
    return jsonify({"error": "Failed to save file"}), 500

@app.route("/download_pdf")
def download_pdf():
    filename = request.args.get('filename')
    if filename and os.path.exists(os.path.join(LECTURE_NOTES_DIR, filename)):
        return send_from_directory(LECTURE_NOTES_DIR, filename)
    return "File not found", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
