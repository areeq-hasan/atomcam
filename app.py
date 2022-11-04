import os
import shutil

import json
from datetime import datetime

import numpy as np
import h5py

import cv2
from skimage.segmentation import active_contour, flood
from skimage.filters import gaussian

from flask import Flask, Response, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

frames = np.load("frames.npz")["data"]


def stream():
    while True:
        for frame in frames:
            yield frame


def raster_stream():
    for frame in stream():
        _, jpeg = cv2.imencode(".jpg", (frame - 1776) / (2688 - 1776) * 255)
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n\r\n"
        )


@app.route("/stream")
def render_stream():
    return Response(
        raster_stream(),
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


@app.route("/snapshot/take")
def take_snapshot():
    snapshot = next(stream())
    now = datetime.now()

    with h5py.File("snapshot_tmp.hdf", "w") as tmp:
        snapshot_ds = tmp.create_dataset("snapshot", data=snapshot)
        snapshot_ds.attrs["timestamp"] = now.timestamp()

    data = {
        "timestamp": str(now.strftime("%x @ %X%p")),
        "snapshot": snapshot.tolist(),
    }

    return data


@app.route("/snapshot/segment", methods=["POST"])
def segment_snapshot():
    segmentation_parameters = request.json
    center = segmentation_parameters["center"]
    radius = segmentation_parameters["radius"]

    with h5py.File("snapshot_tmp.hdf", "r+") as tmp:
        snapshot_ds = tmp["snapshot"]
        snapshot = snapshot_ds[:]

        s = np.linspace(0, 2 * np.pi, 400)
        roi = np.array(
            [center[1] + radius * np.sin(s), center[0] + radius * np.cos(s)]
        ).T

        mask, centroid, size = segment(snapshot, roi)
        segmentation_ds = tmp.create_dataset("segmentation", data=mask)
        segmentation_ds.attrs["centroid"] = centroid
        segmentation_ds.attrs["size"] = size

    data = {
        "mask": mask.astype(int).tolist(),
        "centroid": list(centroid),
        "size": int(size),
    }

    return data


@app.route("/snapshot/store")
def store_snapshot():
    with h5py.File("snapshot_tmp.hdf", "r") as tmp:
        timestamp = tmp["snapshot"].attrs["timestamp"]
    timestamp_dt = datetime.fromtimestamp(timestamp)
    timestamp_str = timestamp_dt.strftime("%Y-%m-%d_%H-%M-%S")
    shutil.copy2("snapshot_tmp.hdf", f"snapshots/{timestamp_str}.hdf")
    os.remove("snapshot_tmp.hdf")
    return timestamp_str
