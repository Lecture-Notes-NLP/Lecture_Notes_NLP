from flask import Flask, render_template, request, jsonify, send_from_directory
import threading
import os
import shutil
import wave
import time
import queue
import pyaudio
import speech_recognition as sr

app = Flask(__name__)

# Global variables
recognized_text_global = ""
chunk_counter = 0
recording = False
recording_thread = None
processing_thread = None
audio_queue = queue.Queue()

# Audio configuration
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
RECORD_SECONDS = 5
DESKTOP_PATH = os.path.join(os.path.expanduser('~'), 'Desktop')
LECTURE_NOTES_DIR = os.path.join(DESKTOP_PATH, 'Lecture_Notes')
OUTPUT_DIR = os.path.join(LECTURE_NOTES_DIR, 'chunks')
FINAL_AUDIO = os.path.join(LECTURE_NOTES_DIR, 'final_recorded_audio.wav')
SENTINEL = b"STOP"

def create_lecture_notes_folder():
    # 🔥 Remove existing Lecture_Notes folder if exists
    if os.path.exists(LECTURE_NOTES_DIR):
        shutil.rmtree(LECTURE_NOTES_DIR)

    os.makedirs(OUTPUT_DIR)  # Create chunks folder inside Lecture_Notes
    print(f"Lecture_Notes folder created at: {LECTURE_NOTES_DIR}")

def start_new_recording_session():
    global recognized_text_global, chunk_counter
    create_lecture_notes_folder()

    recognized_text_global = ""
    chunk_counter = 0

def record_audio():
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
    
    print("Recording started...")
    while recording:
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)
            audio_queue.put(data)
        except Exception as e:
            print(f"Error while recording: {e}")
            break
    
    audio_queue.put(SENTINEL)  # Stop signal

    stream.stop_stream()
    stream.close()
    p.terminate()
    print("Recording stopped...")

def process_chunks():
    global chunk_counter, recognized_text_global
    frames = []
    start_time = time.time()

    while True:
        try:
            data = audio_queue.get(timeout=1)
            if data == SENTINEL:
                print("Stopping processing thread...")
                break

            frames.append(data)
        except queue.Empty:
            continue

        # Create chunk every RECORD_SECONDS
        if time.time() - start_time >= RECORD_SECONDS:
            chunk_filename = os.path.join(OUTPUT_DIR, f"chunk_{chunk_counter}.wav")
            with wave.open(chunk_filename, 'wb') as wf:
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(pyaudio.PyAudio().get_sample_size(FORMAT))
                wf.setframerate(RATE)
                wf.writeframes(b"".join(frames))

            # Process chunk in a separate thread
            threading.Thread(target=process_chunk, args=(chunk_filename, chunk_counter)).start()

            chunk_counter += 1
            frames = []  # Clear frames for next chunk
            start_time = time.time()

def process_chunk(chunk_filename, index):
    global recognized_text_global
    text = recognize_speech_from_file(chunk_filename)
    if text.lower() != "could not understand audio":
        recognized_text_global += text + " "

def recognize_speech_from_file(filename, source_lang='en'):
    recognizer = sr.Recognizer()
    with sr.AudioFile(filename) as source:
        audio_data = recognizer.record(source)
    try:
        text = recognizer.recognize_google(audio_data, language=source_lang)
        return text
    except sr.UnknownValueError:
        return "Could not understand audio"
    except sr.RequestError as e:
        return f"Error with Google Speech Recognition service: {e}"

def merge_audio_files():
    chunk_files = sorted(
        [os.path.join(OUTPUT_DIR, f) for f in os.listdir(OUTPUT_DIR) if f.startswith("chunk_")],
        key=lambda x: int(os.path.basename(x).split('_')[1].split('.')[0])
    )
    if not chunk_files:
        return
    with wave.open(chunk_files[0], 'rb') as w:
        params = w.getparams()
    with wave.open(FINAL_AUDIO, 'wb') as output:
        output.setparams(params)
        for chunk in chunk_files:
            with wave.open(chunk, 'rb') as w:
                frames = w.readframes(w.getnframes())
                output.writeframes(frames)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/start", methods=["POST"])
def start():
    global recording, recording_thread, processing_thread
    if not recording:
        start_new_recording_session()
        recording = True
        
        recording_thread = threading.Thread(target=record_audio, daemon=True)
        processing_thread = threading.Thread(target=process_chunks, daemon=True)

        recording_thread.start()
        processing_thread.start()

        return jsonify({"message": "Recording started."})
    return jsonify({"message": "Recording is already in progress."})

@app.route("/stop", methods=["POST"])
def stop():
    global recording, recording_thread
    if recording:
        recording = False
        if recording_thread is not None:
            recording_thread.join()
            recording_thread = None
        
        # 🔥 Merge audio files and run speech recognition on merged audio
        merge_audio_files()
        recognized_text_global = recognize_speech_from_file(FINAL_AUDIO)

        return jsonify({
            "message": "Recording stopped. Audio merged.",
            "recognized_text": recognized_text_global.strip()
        })
    return jsonify({"message": "Recording is not active."})

@app.route("/recognized_text")
def get_recognized_text():
    return jsonify({"text": recognized_text_global.strip()})

@app.route("/download_audio")
def download_audio():
    if os.path.exists(FINAL_AUDIO):
        return send_from_directory(directory=LECTURE_NOTES_DIR, filename='final_recorded_audio.wav', as_attachment=True)
    return "Final audio file not found.", 404

@app.route("/mcqs")
def mcqs():
    return render_template("mcqindex.html")

if __name__ == "__main__":
    app.run(debug=True)
