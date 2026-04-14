import csv
import random
import os
import logging

logger = logging.getLogger(__name__)

_songs: list = []

_ALIASES = {
    'happiness': 'joy',   'happy':     'joy',   'joy':      'joy',
    'sad':       'sadness','sadness':   'sadness',
    'angry':     'anger',  'anger':     'anger',
    'fearful':   'fear',   'fear':      'fear',
    'surprised': 'surprise','surprise': 'surprise',
    'love':      'love',
    'neutral':   'joy',
}

_BASE  = os.path.dirname(os.path.abspath(__file__))
_CSV   = os.path.join(_BASE, 'data', 'songs_mood.csv')


def _load():
    global _songs
    if _songs:
        return
    if not os.path.exists(_CSV):
        raise FileNotFoundError(f'songs_mood.csv not found at {_CSV}')
    with open(_CSV, newline='', encoding='utf-8') as f:
        _songs = [dict(row) for row in csv.DictReader(f)]
    logger.info(f'Loaded {len(_songs)} songs from CSV')


def get_recommendations(emotion: str, n: int = 8, language: str = 'all') -> list:
    _load()

    mapped   = _ALIASES.get(emotion.lower(), 'joy')
    by_mood  = [s for s in _songs if s.get('emotion') == mapped]

    # Filter by language
    if language and language != 'all':
        by_lang = [s for s in by_mood if s.get('language', '').lower() == language.lower()]
        # Only use language filter if we have at least 3 matches
        if len(by_lang) >= 3:
            by_mood = by_lang

    # If still not enough, pad with same-emotion songs (don't mix other emotions)
    result = by_mood.copy()
    if len(result) < n and len(by_mood) > 0:
        # Repeat and sample — better than mixing emotions
        while len(result) < n:
            result.extend(by_mood)
    if len(result) == 0:
        result = _songs  # absolute fallback

    return random.sample(result, min(n, len(result)))