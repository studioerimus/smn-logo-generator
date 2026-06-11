import { useState, useCallback } from 'react'
import { generate } from './algorithm'
import type { GeneratorParams } from './algorithm'

export interface Locks {
  gridSize: boolean
  nodeCount: boolean
  contrast: boolean
  sizeVariation: boolean
}

export interface HistoryEntry {
  seed: number
  thumbnail: string
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000)
}

const DEFAULT_PARAMS: GeneratorParams = {
  seed: randomSeed(),
  gridSize: 4,
  nodeCount: 6,
  contrast: 0.5,
  sizeVariation: 0,
}

export function useGenerator() {
  const [params, setParams] = useState<GeneratorParams>(DEFAULT_PARAMS)
  const [locks, setLocks] = useState<Locks>({
    gridSize: false,
    nodeCount: false,
    contrast: false,
    sizeVariation: false,
  })
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const result = generate(params)

  const addToHistory = useCallback(
    (seed: number, thumbnail: string) => {
      setHistory(prev => {
        const filtered = prev.filter(e => e.seed !== seed)
        return [{ seed, thumbnail }, ...filtered].slice(0, 12)
      })
    },
    []
  )

  const randomise = useCallback(
    (makeThumbnail: (seed: number) => string) => {
      const newSeed = randomSeed()
      const newParams: GeneratorParams = {
        seed: newSeed,
        gridSize: params.gridSize,
        nodeCount: params.nodeCount,
        contrast: params.contrast,
        sizeVariation: params.sizeVariation,
      }
      if (!locks.gridSize) newParams.gridSize = 4 + Math.floor(Math.random() * 3)
      if (!locks.nodeCount) newParams.nodeCount = 4 + Math.floor(Math.random() * 6)
      if (!locks.contrast) newParams.contrast = Math.random()
      if (!locks.sizeVariation) newParams.sizeVariation = Math.random()

      addToHistory(params.seed, makeThumbnail(params.seed))
      setParams(newParams)
    },
    [params, locks, addToHistory]
  )

  const updateParam = useCallback(
    <K extends keyof GeneratorParams>(key: K, value: GeneratorParams[K]) => {
      setParams(prev => ({ ...prev, [key]: value }))
    },
    []
  )

  const toggleLock = useCallback((key: keyof Locks) => {
    setLocks(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const recallSeed = useCallback(
    (entry: HistoryEntry) => {
      setParams(prev => ({ ...prev, seed: entry.seed }))
    },
    []
  )

  return {
    params,
    locks,
    result,
    history,
    randomise,
    updateParam,
    toggleLock,
    recallSeed,
    addToHistory,
  }
}
