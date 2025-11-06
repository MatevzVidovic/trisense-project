

# for the yolov4 docker container, run: as python3 -m tests.canvas_test 

from DB.detection_store import DetectionStore

store = DetectionStore()


height = 1080
width = 1920

print("[starting test]")

# make a line from middle of left vertical border to the middle of bottom horizontal border
dhs = 100    # detection_half_size
for i in range(1, 100):
    k = i/100
    y = (height / 2) + (height / 2) * k
    x = (width / 2) * k
    store.log_detection(track_ix=1, frame_ix=i, class_name="car",
                            conf=0.7, xmin=(x-dhs), ymin=(y-dhs), xmax=(x+dhs), ymax=(y+dhs))

store.log_frame_dims(frame_height=height, frame_width=width)


store.close()