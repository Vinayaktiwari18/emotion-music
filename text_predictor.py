import os
import re
import joblib
import logging

logger = logging.getLogger(__name__)

_model      = None
_vectorizer = None
_lemmatizer = None
_stop_words = None

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'svm_emotion_model.joblib')
VEC_PATH   = os.path.join(BASE_DIR, 'models', 'tfidf_vectorizer.joblib')
NLTK_DIR   = os.path.join(BASE_DIR, 'nltk_data')


def _setup_nltk():
    import nltk
    nltk.data.path.insert(0, NLTK_DIR)
    os.makedirs(NLTK_DIR, exist_ok=True)
    for pkg in ['stopwords', 'wordnet', 'omw-1.4']:
        try:
            nltk.download(pkg, download_dir=NLTK_DIR, quiet=True)
        except Exception:
            pass


def _load():
    global _model, _vectorizer, _lemmatizer, _stop_words
    if _model is not None:
        return
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f'Model not found at {MODEL_PATH}. Run training/train_text_model.py first.')
    if not os.path.exists(VEC_PATH):
        raise FileNotFoundError(f'Vectorizer not found at {VEC_PATH}. Run training/train_text_model.py first.')
    _setup_nltk()
    from nltk.corpus import stopwords
    from nltk.stem import WordNetLemmatizer
    _lemmatizer = WordNetLemmatizer()
    _stop_words = set(stopwords.words('english'))
    _model      = joblib.load(MODEL_PATH)
    _vectorizer = joblib.load(VEC_PATH)
    logger.info('Text model loaded successfully')


def _preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    tokens = [
        _lemmatizer.lemmatize(t)
        for t in text.split()
        if t not in _stop_words and len(t) > 1
    ]
    return ' '.join(tokens)


def predict_emotion(text: str) -> dict:
    _load()
    processed  = _preprocess(text)
    if not processed.strip():
        return {'emotion': 'joy', 'confidence': 50.0, 'source': 'text'}
    vec        = _vectorizer.transform([processed])
    emotion    = _model.predict(vec)[0]
    proba      = _model.predict_proba(vec)[0]
    confidence = round(float(max(proba)) * 100, 1)
    low_conf   = confidence < 45
    return {
        'emotion':    emotion,
        'confidence': confidence,
        'source':     'text',
        'low_confidence': low_conf,
    }


if __name__ == '__main__':
    tests = [
        "I am so happy today, life is beautiful!",
        "I feel completely alone and broken.",
        "This makes me so angry I could scream.",
        "I am deeply in love with everything.",
        "I am terrified of what might happen.",
    ]
    for t in tests:
        r = predict_emotion(t)
        print(f"{t[:45]:<45} → {r['emotion'].upper():<10} {r['confidence']}%")