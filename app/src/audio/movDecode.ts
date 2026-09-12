import { createFile, MP4BoxBuffer } from 'mp4box'

/**
 * 사파리는 .mov(ftyp qt)와 Opus를 decodeAudioData로 거부한다 (2026-09-13 확인, 아이패드·맥 모두).
 * 아이폰·아이패드로 찍은 영상이 전부 .mov라 그냥 두면 하나도 안 열린다.
 * 그래서 mp4box로 소리 트랙만 뜯고 WebCodecs AudioDecoder로 PCM을 직접 뽑는다. 재인코딩 없음.
 */
export async function decodeAudioTrack(bytes: ArrayBuffer): Promise<{ channels: Float32Array<ArrayBuffer>[]; sampleRate: number }> {
  if (typeof AudioDecoder === 'undefined') throw new Error('이 브라우저는 WebCodecs가 없어 이 파일을 열 수 없습니다')

  const file = createFile()
  const chunks: Float32Array<ArrayBuffer>[][] = []
  let decoder: AudioDecoder | undefined
  let sampleRate = 0
  let planar = true
  let expected = 0
  let got = 0

  const done = new Promise<void>((resolve, reject) => {
    const fail = (m: string) => reject(new Error(m))
    file.onError = (e: unknown) => fail(String(e))

    file.onSamples = (_id, _user, samples) => {
      for (const s of samples) {
        decoder!.decode(new EncodedAudioChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: (s.cts * 1e6) / s.timescale,
          duration: (s.duration * 1e6) / s.timescale,
          data: s.data as unknown as BufferSource,
        }))
      }
      got += samples.length
      if (got >= expected) resolve()
    }

    // 추출 설정과 start()는 반드시 onReady 안에서, 즉 appendBuffer가 도는 동안 해야 한다.
    // await 뒤로 미루면 mp4box가 이미 쓴 버퍼를 비워서 샘플이 한 개도 안 나온다 (2026-09-13에 걸렸다).
    file.onReady = (info: any) => {
      const track = info.tracks.find((t: any) => t.type === 'audio' || t.audio)
      if (!track) return fail('소리 트랙이 없는 파일입니다')
      expected = track.nb_samples
      sampleRate = track.audio.sample_rate

      // QuickTime 컨테이너는 코덱을 'mp4a'/'Opus'로만 알려 주는데 WebCodecs는 더 자세한 이름을 요구한다.
      const raw = String(track.codec)
      const codec = raw === 'mp4a' ? 'mp4a.40.2' : raw.toLowerCase().startsWith('opus') ? 'opus' : raw

      decoder = new AudioDecoder({
        output: (data) => {
          sampleRate = data.sampleRate
          const frame: Float32Array<ArrayBuffer>[] = []
          for (let c = 0; c < data.numberOfChannels; c++) {
            const buf = new Float32Array(new ArrayBuffer(data.numberOfFrames * 4))
            try {
              data.copyTo(buf, { planeIndex: planar ? c : 0, format: 'f32-planar' })
            } catch {
              planar = false            // 채널을 못 가르면 첫 채널만 쓴다 (분석은 어차피 모노)
              data.copyTo(buf, { planeIndex: 0, format: 'f32-planar' })
            }
            frame.push(buf)
            if (!planar) break
          }
          chunks.push(frame)
          data.close()
        },
        error: (e) => fail(`소리를 푸는 중 오류: ${e.message}`),
      })
      decoder.configure({ codec, sampleRate: track.audio.sample_rate, numberOfChannels: track.audio.channel_count,
        description: aacDescription(file, track.id) })

      file.setExtractionOptions(track.id, undefined, { nbSamples: 100000 })
      file.start()
    }

    setTimeout(() => fail('소리 트랙을 꺼내지 못했습니다'), 60000)
  })

  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(bytes, 0))
  file.flush()
  await done
  await decoder!.flush()
  decoder!.close()

  if (!chunks.length) throw new Error('소리가 비어 있습니다')
  const nCh = chunks[0].length
  const total = chunks.reduce((n, f) => n + f[0].length, 0)
  const channels = Array.from({ length: nCh }, () => new Float32Array(new ArrayBuffer(total * 4)))
  let offset = 0
  for (const frame of chunks) {
    for (let c = 0; c < nCh; c++) channels[c].set(frame[c], offset)
    offset += frame[0].length
  }
  return { channels, sampleRate }
}

/** AAC는 AudioSpecificConfig(esds)를 넘겨야 디코더가 설정된다. Opus 등은 없어도 된다. */
function aacDescription(file: any, trackId: number): Uint8Array | undefined {
  const entry = file.getTrackById(trackId)?.mdia?.minf?.stbl?.stsd?.entries?.[0]
  const esds = entry?.esds ?? entry?.mp4a?.esds
  if (!esds) return undefined
  for (const d of esds.esd.descs) for (const dd of d.descs ?? []) if (dd.data) return dd.data
  return undefined
}
