import os
import logging
import nltk
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# ── NLTK — download once into persistent location ─────────────
NLTK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nltk_data')
os.makedirs(NLTK_DIR, exist_ok=True)
nltk.data.path.insert(0, NLTK_DIR)
for _pkg in ['stopwords', 'wordnet', 'omw-1.4']:
    try:
        nltk.download(_pkg, download_dir=NLTK_DIR, quiet=True)
    except Exception as _e:
        logger.warning(f'NLTK download failed for {_pkg}: {_e}')

# ── App ───────────────────────────────────────────────────────
app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Health check ──────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({'status': 'ok'}), 200

# ── Home ──────────────────────────────────────────────────────
@app.route('/')
def home():
    return render_template('index.html')

# ── Text prediction ───────────────────────────────────────────
@app.route('/predict/text', methods=['POST'])
def predict_text():
    try:
        from text_predictor import predict_emotion
        data = request.get_json(silent=True) or {}
        text = str(data.get('text') or '').strip()[:500]
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        result = predict_emotion(text)
        return jsonify(result)
    except FileNotFoundError:
        logger.error('Model files not found')
        return jsonify({'error': 'Model not loaded. Please train the model first.'}), 503
    except Exception as e:
        logger.error(f'Text prediction error: {e}')
        return jsonify({'error': 'Prediction failed'}), 500

# ── Face prediction ───────────────────────────────────────────
@app.route('/predict/face', methods=['POST'])
def predict_face():
    try:
        from face_predictor import predict_from_base64
        data = request.get_json(silent=True) or {}
        image_b64 = str(data.get('image') or '')
        if not image_b64:
            return jsonify({'error': 'No image provided'}), 400
        result = predict_from_base64(image_b64)
        return jsonify(result)
    except Exception as e:
        logger.error(f'Face prediction error: {e}')
        return jsonify({'error': 'Face prediction failed'}), 500

# ── Recommend ─────────────────────────────────────────────────
@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        from music_recommender import get_recommendations
        data = request.get_json(silent=True) or {}
        emotion  = str(data.get('emotion')  or 'joy').strip().lower()
        language = str(data.get('language') or 'all').strip().lower()
        songs = get_recommendations(emotion, n=8, language=language)
        return jsonify({'songs': songs, 'emotion': emotion})
    except FileNotFoundError:
        logger.error('songs_mood.csv not found')
        return jsonify({'error': 'Music data not found'}), 503
    except Exception as e:
        logger.error(f'Recommend error: {e}')
        return jsonify({'error': 'Could not load recommendations'}), 500

# ── Run ───────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    logger.info(f'Starting on port {port}')
    app.run(debug=debug, port=port, host='0.0.0.0')