import os
import shutil

import itertools

import json

from datetime import datetime

import numpy as np
import h5py

import cv2
from skimage.segmentation import active_contour, flood
from skimage.filters import gaussian

from flask import Flask, Response, request
from flask_cors import CORS

# from instrumental.drivers.cameras import Camera

# cam = Camera(...)
# cam.start_live_video()
frames = np.load("frames.npz")["data"]

app = Flask(__name__)
CORS(app)


def stream():
    while True:
        # if cam.wait_for_frame():
        #   yield cam.latest_frame()
        for frame in frames:
            yield frame


def stream_rasterized():
    for frame in stream():
        _, jpeg = cv2.imencode(".jpg", (frame - 1776) / (2688 - 1776) * 255)
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n\r\n"
        )


def stream_snapshots(num_frames, analysis_config=None):
    snapshot_frames = []
    snapshot_count = 0
    for frame_count, frame in enumerate(stream()):
        snapshot_frames.append(frame)
        if frame_count % num_frames != 0:
            continue

        snapshot_count += 1
        snapshot = np.mean(snapshot_frames, axis=0)
        now = datetime.now()

        payload = {
            "timestamp": str(now.strftime("%x @ %X%p")),
            "count": snapshot_count,
            "data": snapshot.tolist(),
            "analysis": None,
        }

        if analysis_config:
            center = analysis_config["center"]
            radius = analysis_config["radius"]

            s = np.linspace(0, 2 * np.pi, 400)
            roi = np.array(
                [center[1] + radius * np.sin(s), center[0] + radius * np.cos(s)]
            ).T

            mask, centroid, size = segment(snapshot, roi)

            payload["analysis"] = {
                "mask": mask.astype(int).tolist(),
                "centroid": list(centroid),
                "size": int(size),
            }

            store = analysis_config["store"]
            if store:
                timestamp_str = now.strftime("%Y-%m-%d_%H-%M-%S")
                with h5py.File(
                    f"snapshots/{timestamp_str}_{snapshot_count}.hdf", "w"
                ) as snapshot_file:
                    snapshot_ds = snapshot_file.create_dataset(
                        "snapshot", data=snapshot
                    )
                    snapshot_ds.attrs["timestamp"] = now.timestamp()
                    snapshot_ds.attrs["count"] = snapshot_count

                    segmentation_ds = snapshot_file.create_dataset(
                        "segmentation", data="mask"
                    )
                    segmentation_ds.attrs["centroid"] = centroid
                    segmentation_ds.attrs["size"] = size

        print(frame_count, snapshot.shape)
        yield f"data: {json.dumps(payload)}\n\n"

        snapshot_frames = []


@app.route("/stream")
def render_stream():
    return Response(
        stream_rasterized(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


def segment(image, roi):
    contour = active_contour(image, roi, gamma=0.001)
    contour_centroid = tuple(
        np.round(np.mean(contour, axis=0)[::-1]).astype(int).tolist()
    )
    mask = flood(
        gaussian(image, sigma=1.5, preserve_range=True),
        contour_centroid[::-1],
        tolerance=200,
    )
    size = np.sum(mask)
    interior = np.where(mask > 0)
    centroid = tuple(np.round(np.mean(interior[::-1], axis=1)).astype(int).tolist())
    return mask, centroid, size


# @app.route("/snapshot/stream", methods=["POST"])
# def take_snapshot():
#     snapshot_parameters = request.json
#     num_frames = snapshot_parameters["numFrames"]
#     return Response(stream_snapshots(num_frames), mimetype="text/event-stream")


@app.route("/snapshot/stream")
def take_snapshot():
    num_frames = int(request.args["numFrames"])
    analyze = request.args["analyze"] == "true"
    analysis_config = None
    if analyze:
        analysis_config = {
            "center": list(map(int, request.args.getlist("center"))),
            "radius": int(request.args["radius"]),
            "store": request.args["store"] == "true",
        }
    return Response(
        stream_snapshots(num_frames, analysis_config),
        mimetype="text/event-stream",
    )


if __name__ == "__main__":
    app.run(threaded=True)
