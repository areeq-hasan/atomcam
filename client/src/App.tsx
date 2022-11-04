import { useState, useEffect } from 'react'

import Plot from 'react-plotly.js'

import './App.css'

interface SnapshotParameters {
  frames: number
}

interface SnapshotData {
  timestamp: string,
  snapshot: Array<Array<number>>,
}

interface SegmentationParameters {
  center: Array<number>,
  radius: number
}

interface SegmentationData {
  mask: Array<Array<number>>,
  centroid: Array<number>,
  size: number
}

function App() {

  const [snapshotParameters, setSnapshotParameters] = useState<SnapshotParameters>({ frames: 1 })
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null)

  const [segmentationParameters, setSegmentationParameters] = useState<SegmentationParameters>({ center: [250, 350], radius: 50 })
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null)

  return (
    <div className="App">
      <div>
        <h1>Atom Observer</h1>
        <div className="wrapper">
          <div className="stream">
            <h2>Stream</h2>
            <div>
              <img src="http://127.0.0.1:5000/stream" style={{ width: 346, height: 521, paddingTop: 156, paddingBottom: 79 }}></img>
              <div className="parameters-form">
                <h3>Snapshot Parameters</h3>
                <div className="parameter-wrapper">
                  <p>Frames / Snapshot: </p>
                  <input
                    type="number"
                    value={snapshotParameters.frames}
                    onChange={(e) => setSnapshotParameters({ ...snapshotParameters, frames: e.target.valueAsNumber })} />
                </div>
                <button onClick={() => {
                  fetch("http://127.0.0.1:5000/snapshot/take").then(result => result.json())
                    .then(
                      (result: SnapshotData) => {
                        setSegmentationData(null)
                        setSnapshotData(result)
                      }
                    )
                }}>Take Snapshot</button>
              </div>
            </div>
          </div>
          <div className="snapshot">
            <h2>Snapshot</h2>
            {snapshotData ?
              <div>
                <p>Timestamp: {snapshotData.timestamp}</p>
                <Plot
                  data={[
                    {
                      z: snapshotData.snapshot,
                      type: 'heatmap',

                    },
                  ]}
                  layout={{ width: 500, height: 700, yaxis: { autorange: "reversed" } }}
                />
                <div className="parameters-form">
                  <h3>Segmentation Parameters</h3>
                  <h4>Region of Interest (ROI)</h4>
                  <div className="parameter-wrapper">
                    <p>Center: </p>
                    <input
                      type="number"
                      value={segmentationParameters.center[0]}
                      onChange={(e) => setSegmentationParameters({ ...segmentationParameters, center: [e.target.valueAsNumber, segmentationParameters.center[1]] })} />
                    <input
                      type="number"
                      value={segmentationParameters.center[1]}
                      onChange={(e) => setSegmentationParameters({ ...segmentationParameters, center: [segmentationParameters.center[0], e.target.valueAsNumber] })} />
                  </div>
                  <div className="parameter-wrapper">
                    <p>Radius: </p>
                    <input
                      type="number"
                      value={segmentationParameters.radius}
                      onChange={(e) => setSegmentationParameters({ ...segmentationParameters, radius: e.target.valueAsNumber })} />
                  </div>
                  <button onClick={() => {
                    fetch("http://127.0.0.1:5000/snapshot/segment", {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(segmentationParameters)
                    }).then(result => result.json())
                      .then(
                        (result: SegmentationData) => {
                          setSegmentationData(result)
                        }
                      )
                  }}>Segment Snapshot</button>
                </div>
              </div>
              : <p>
                Once you take a snapshot, you can view the results here and configure its segmentation.
              </p>
            }
          </div>
          <div className="segmentation">
            <h2>Segmentation</h2>
            {segmentationData ?
              <div>
                <p>Centroid: ({segmentationData.centroid[0]}, {segmentationData.centroid[1]}); Size: {segmentationData.size}</p>
                <Plot
                  data={[
                    {
                      z: segmentationData.mask,
                      type: 'heatmap',
                    },
                  ]}
                  layout={{ width: 500, height: 700, yaxis: { autorange: "reversed" } }}
                />
                <button onClick={() => {
                  fetch("http://127.0.0.1:5000/snapshot/store").then(() => {
                    setSnapshotData(null)
                    setSegmentationData(null)
                  })
                }}>Store Snapshot</button>
              </div> : <p>
                Once you segment a snapshot, you can view the results here and store the snapshot.
              </p>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
