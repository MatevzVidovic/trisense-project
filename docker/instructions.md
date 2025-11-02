


# env is cached unless conda-gpu.yml changes
docker compose build

# Start an interactive shell inside the container with env active
docker compose run --rm app

# (Inside) quick GPU sanity check
python -c "import sys; print(sys.version)"
python -c "import tensorflow as tf; print(tf.__version__); print(tf.config.list_physical_devices('GPU'))"



python save_model.py --weights ./data/yolov4-tiny.weights --model yolov4 --tiny true

python object_tracker.py --video ./data/video/cars.mp4 --output ./outputs/cars.avi --model yolov4 --tiny true --dont_show