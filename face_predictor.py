import base64
import os
import logging
import platform

logger = logging.getLogger(__name__)

_EMOTION_MAP = {
    'happy':    'joy',
    'sad':      'sadness',
    'angry':    'anger',
    'disgust':  'anger',
    'fear':     'fear',
    'surprise': 'surprise',
    'neutral':  'joy',
}

_IS_MAC = platform.system() == 'Darwin'


def predict_from_base64(image_b64: str) -> dict:
    # On non-Mac (Render/Linux) return informative message
    if not _IS_MAC:
        return {
            'emotion':    'joy',
            'confidence': 0,
            'source':     'face',
            'error':      'Face detection requires the local desktop version. Use Mood Pick or Write Feeling instead.',
        }

    try:
        import cv2
        import numpy as np
        from fer import FER

        # Decode base64 image
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]

        img_bytes = base64.b64decode(image_b64)
        nparr     = np.frombuffer(img_bytes, np.uint8)
        img_bgr   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img_bgr is None:
            return {'emotion': 'joy', 'confidence': 0, 'source': 'face', 'error': 'Could not decode image'}

        # Resize large images to avoid memory issues
        h, w = img_bgr.shape[:2]
        if max(h, w) > 640:
            scale   = 640 / max(h, w)
            img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)))

        detector = FER(mtcnn=False)
        result   = detector.detect_emotions(img_bgr)

        if not result:
            return {
                'emotion':    'neutral',
                'confidence': 0,
                'source':     'face',
                'error':      'No face detected — try better lighting and face the camera directly',
            }

        emotions   = result[0]['emotions']
        raw_label  = max(emotions, key=emotions.get)
        confidence = round(float(emotions[raw_label]) * 100, 1)
        mapped     = _EMOTION_MAP.get(raw_label, 'joy')

        return {
            'emotion':    mapped,
            'confidence': confidence,
            'raw':        raw_label,
            'source':     'face',
        }

    except ImportError as e:
        logger.error(f'Missing dependency for face detection: {e}')
        return {'emotion': 'joy', 'confidence': 0, 'source': 'face', 'error': f'Missing library: {e}'}
    except Exception as e:
        logger.error(f'Face prediction error: {e}')
        return {'emotion': 'joy', 'confidence': 0, 'source': 'face', 'error': str(e)}