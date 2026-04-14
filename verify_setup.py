print("\n--- Emotion Music: Setup Verification ---\n")

try:
    import numpy as np
    print(f"✅ NumPy {np.__version__}")
except Exception as e:
    print(f"❌ NumPy — {e}")

try:
    import tensorflow as tf
    gpus = tf.config.list_physical_devices('GPU')
    print(f"✅ TensorFlow {tf.__version__} | {'M1 GPU ✅' if gpus else 'CPU only ⚠️'}")
except Exception as e:
    print(f"❌ TensorFlow — {e}")

try:
    import sklearn
    print(f"✅ scikit-learn {sklearn.__version__}")
except Exception as e:
    print(f"❌ scikit-learn — {e}")

try:
    import cv2
    print(f"✅ OpenCV {cv2.__version__}")
except Exception as e:
    print(f"❌ OpenCV — {e}")

try:
    import flask
    print(f"✅ Flask {flask.__version__}")
except Exception as e:
    print(f"❌ Flask — {e}")

try:
    from fer import FER
    print("✅ FER (face emotion CNN)")
except Exception as e:
    print(f"❌ FER — {e}")

try:
    import nltk
    print(f"✅ NLTK {nltk.__version__}")
except Exception as e:
    print(f"❌ NLTK — {e}")

print("\n--- All checks done ---\n")