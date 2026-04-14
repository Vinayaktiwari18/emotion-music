import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import re
import joblib
import logging
import nltk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR  = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR  = os.path.join(BASE_DIR, 'data')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
NLTK_DIR  = os.path.join(BASE_DIR, 'nltk_data')

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(NLTK_DIR,  exist_ok=True)
nltk.data.path.insert(0, NLTK_DIR)
for pkg in ['stopwords', 'wordnet', 'omw-1.4']:
    nltk.download(pkg, download_dir=NLTK_DIR, quiet=True)

from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib
matplotlib.use('Agg')  # non-interactive backend — works without display
import matplotlib.pyplot as plt
import seaborn as sns

lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words('english'))


def load_data(filepath: str):
    texts, labels = [], []
    if not os.path.exists(filepath):
        raise FileNotFoundError(f'Dataset file not found: {filepath}')
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if ';' in line:
                parts = line.rsplit(';', 1)
                if len(parts) == 2 and parts[1].strip():
                    texts.append(parts[0].strip())
                    labels.append(parts[1].strip())
    return texts, labels


def preprocess(text: str) -> str:
    text   = text.lower()
    text   = re.sub(r'[^a-z\s]', ' ', text)
    text   = re.sub(r'\s+', ' ', text).strip()
    tokens = [lemmatizer.lemmatize(t) for t in text.split()
              if t not in stop_words and len(t) > 1]
    return ' '.join(tokens)


logger.info('Loading dataset…')
train_texts, train_labels = load_data(os.path.join(DATA_DIR, 'train.txt'))
val_texts,   val_labels   = load_data(os.path.join(DATA_DIR, 'val.txt'))
test_texts,  test_labels  = load_data(os.path.join(DATA_DIR, 'test.txt'))
logger.info(f'Train: {len(train_texts)} | Val: {len(val_texts)} | Test: {len(test_texts)}')

logger.info('Preprocessing…')
train_clean = [preprocess(t) for t in train_texts]
val_clean   = [preprocess(t) for t in val_texts]
test_clean  = [preprocess(t) for t in test_texts]

logger.info('Vectorizing with TF-IDF…')
vectorizer = TfidfVectorizer(max_features=15000, ngram_range=(1, 2), sublinear_tf=True)
X_train    = vectorizer.fit_transform(train_clean)
X_val      = vectorizer.transform(val_clean)
X_test     = vectorizer.transform(test_clean)

logger.info('Training SVM…')
model = SVC(kernel='rbf', C=2.0, gamma='scale', probability=True, random_state=42)
model.fit(X_train, train_labels)

val_acc  = accuracy_score(val_labels,  model.predict(X_val))
test_acc = accuracy_score(test_labels, model.predict(X_test))
logger.info(f'Validation Accuracy : {val_acc*100:.2f}%')
logger.info(f'Test Accuracy       : {test_acc*100:.2f}%')
print(classification_report(test_labels, model.predict(X_test)))

# Confusion matrix
labels_order = ['joy', 'sadness', 'anger', 'fear', 'love', 'surprise']
cm = confusion_matrix(test_labels, model.predict(X_test), labels=labels_order)
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='YlOrBr',
            xticklabels=labels_order, yticklabels=labels_order)
plt.title(f'SVM Confusion Matrix — Test Accuracy: {test_acc*100:.1f}%')
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.tight_layout()
plt.savefig(os.path.join(MODEL_DIR, 'confusion_matrix.png'), dpi=150)
plt.close()
logger.info('Confusion matrix saved')

# Save models
joblib.dump(model,      os.path.join(MODEL_DIR, 'svm_emotion_model.joblib'))
joblib.dump(vectorizer, os.path.join(MODEL_DIR, 'tfidf_vectorizer.joblib'))
logger.info(f'Models saved to {MODEL_DIR}')