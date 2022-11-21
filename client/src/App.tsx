import { useState, useEffect } from 'react'

import Plot from 'react-plotly.js'

import './App.css'

interface AcquisitionConfig {
  numFrames: number
}

interface AnalysisConfig {
  center: Array<number>
  radius: number
  store: boolean
}

interface Snapshot {
  timestamp: string
  data: Array<Array<number>>
  count: number
  analysis?: Analysis
}

interface Analysis {
  mask: Array<Array<number>>
  centroid: Array<number>
  size: number
}

function App() {

  const [acquisitionConfig, configureAcquisition] = useState<AcquisitionConfig>({ numFrames: 1 })

  const [analyze, setAnalyze] = useState<boolean>(false)
  const [analysisConfig, configureAnalysis] = useState<AnalysisConfig>({ center: [250, 350], radius: 50, store: true })

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  const [active, setActive] = useState<boolean>(false)

  useEffect(() => {
    let snapshotEventSource: EventSource | null = null
    if (active) {
      const serializedParameters = new URLSearchParams()
      serializedParameters.append("numFrames", acquisitionConfig.numFrames.toString())
      serializedParameters.append("analyze", analyze.toString())
      if (analyze) {
        serializedParameters.append("center", analysisConfig.center[0].toString())
        serializedParameters.append("center", analysisConfig.center[1].toString())
        serializedParameters.append("radius", analysisConfig.radius.toString())
        serializedParameters.append("store", analysisConfig.store.toString())
      }
      snapshotEventSource = new EventSource(`http://127.0.0.1:5000/snapshot/stream?${serializedParameters.toString()}`)
      snapshotEventSource.onmessage = (e) => {
        setSnapshot(JSON.parse(e.data))
      }
    }
    return () => {
      snapshotEventSource?.close()
    };
  }, [active]);

  return (
    <div className="App">
      <div>
        <h1>Atom Observer</h1>
        <div className="stack">
          <h2>Experiment</h2>
          <div className="wrapper">
            <div className="stream">
              <h3>Stream</h3>
              <div>
                <img src="http://127.0.0.1:5000/stream" style={{ width: 346, height: 521, paddingTop: 156, paddingBottom: 79 }}></img>
              </div>
            </div>
            {active && snapshot && <>
              <div className="snapshot">
                <h3>Snapshot (#{snapshot.count})</h3>
                <div>
                  <p><b>Timestamp</b>: {snapshot.timestamp}</p>
                  <Plot
                    data={[
                      {
                        z: snapshot.data,
                        type: 'heatmap',

                      },
                    ]}
                    layout={{ width: 500, height: 700, yaxis: { autorange: "reversed" } }}
                  />
                </div>
              </div>
              {snapshot.analysis &&
                <div className="segmentation">
                  <h3>Analysis</h3>
                  <div>
                    <p>Centroid: ({snapshot.analysis.centroid[0]}, {snapshot.analysis.centroid[1]}); Size: {snapshot.analysis.size}</p>
                    <Plot
                      data={[
                        {
                          z: snapshot.analysis.mask,
                          type: 'heatmap',
                        },
                      ]}
                      layout={{ width: 500, height: 700, yaxis: { autorange: "reversed" } }}
                    />
                  </div>
                </div>
              }
            </>}
          </div>
        </div>
        <div className="wrapper">
          <div className="stack">
            <h2>Configuration</h2>
            <div className="wrapper">
              <div className="parameters-form">
                <h3>Acquisition</h3>
                <div className="parameter-wrapper">
                  <p>Frames / Snapshot: </p>
                  <input
                    type="number"
                    value={acquisitionConfig.numFrames}
                    onChange={(e) => configureAcquisition({ ...acquisitionConfig, numFrames: e.target.valueAsNumber })}
                    disabled={active} />
                </div>
              </div>
              <div className="parameters-form">
                <h3>Analysis <input type="checkbox" checked={analyze} onChange={() => setAnalyze(!analyze)} disabled={active} /></h3>
                {analyze ? <><h4>Region of Interest (ROI)</h4>
                  <div className="parameter-wrapper">
                    <p>Center: </p>
                    <input
                      type="number"
                      value={analysisConfig.center[0]}
                      onChange={(e) => configureAnalysis({ ...analysisConfig, center: [e.target.valueAsNumber, analysisConfig.center[1]] })}
                      disabled={active} />
                    <input
                      type="number"
                      value={analysisConfig.center[1]}
                      onChange={(e) => configureAnalysis({ ...analysisConfig, center: [analysisConfig.center[0], e.target.valueAsNumber] })}
                      disabled={active} />
                  </div>
                  <div className="parameter-wrapper">
                    <p>Radius: </p>
                    <input
                      type="number"
                      value={analysisConfig.radius}
                      onChange={(e) => configureAnalysis({ ...analysisConfig, radius: e.target.valueAsNumber })}
                      disabled={active} />
                  </div>
                  <h4>Storage <input type="checkbox" checked={analysisConfig.store} onChange={() => configureAnalysis({ ...analysisConfig, store: !analysisConfig.store })} disabled={active} /></h4>
                </> : <p>Tick "Analysis" to configure analysis.</p>}
              </div>
              <button onClick={() => setActive(!active)}>{!active ? "Start" : "Stop"}</button>
            </div>
          </div>
        </div>
      </div>
    </div >
  )
}

export default App
