# Benchmark Results

The normalized source data for these tables is stored in [`benchmark/benchmark-results.csv`](https://github.com/rChimisso/game-of-life-tribes/blob/main/benchmark/benchmark-results.csv), where the full benchmark values can be checked directly.

The tables report the best observed run out of three repeats. For this kind of benchmark, the best run is often the most useful estimate of how fast the device can execute the workload when background interference is lowest. Slower repeats can still be useful to inspect, but they often include unrelated scheduling, browser, or system activity rather than a slower simulation engine. Since this table reports throughput, the selected value is the highest `Gen/s` observed for that row.

Columns:

- **Bit packing**: bits used to store each cell in the simulation frame.
- **Frame size**: recording-only raw size of one simulation frame at that grid size and packing.
- **Gen/s**: best observed generations per second during the post-warm-up max-speed window.
- **Cell updates/s**: `Gen/s` multiplied by the number of cells in the actual measured grid.
- **Data volume/s**: recording-only raw frame volume, computed as `Gen/s * frame size`.

## 128 x 128

The full grid contains **16,384 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~176k |     ~2.88B     |
|           2 | ~307k |     ~5.04B     |
|           4 | ~313k |     ~5.13B     |
|           8 | ~523k |     ~8.56B     |
|          16 | ~523k |     ~8.56B     |
|          32 | ~523k |     ~8.56B     |

### Recording

| Bit packing | Frame size | Gen/s  | Data volume/s | Cell updates/s |
| ----------: | :--------: | :----: | :-----------: | :------------: |
|           1 |   2 KiB    | ~155k  |  ~302 MiB/s   |     ~2.53B     |
|           2 |   4 KiB    | ~123k  |  ~480 MiB/s   |     ~2.01B     |
|           4 |   8 KiB    | ~70.1k |  ~548 MiB/s   |     ~1.15B     |
|           8 |   16 KiB   | ~38.9k |  ~607 MiB/s   |     ~637M      |
|          16 |   32 KiB   | ~22.1k |  ~691 MiB/s   |     ~362M      |
|          32 |   64 KiB   | ~11.5k |  ~717 MiB/s   |     ~188M      |

## 256 x 256

The full grid contains **65,536 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~174k |     ~11.4B     |
|           2 | ~305k |      ~20B      |
|           4 | ~313k |     ~20.5B     |
|           8 | ~313k |     ~20.5B     |
|          16 | ~418k |     ~27.4B     |
|          32 | ~523k |     ~34.3B     |

### Recording

| Bit packing | Frame size | Gen/s  | Data volume/s | Cell updates/s |
| ----------: | :--------: | :----: | :-----------: | :------------: |
|           1 |   8 KiB    | ~75.4k |  ~589 MiB/s   |     ~4.94B     |
|           2 |   16 KiB   | ~36.4k |  ~569 MiB/s   |     ~2.39B     |
|           4 |   32 KiB   | ~19.7k |  ~614 MiB/s   |     ~1.29B     |
|           8 |   64 KiB   | ~10.2k |  ~640 MiB/s   |     ~671M      |
|          16 |  128 KiB   | ~5.53k |  ~691 MiB/s   |     ~362M      |
|          32 |  256 KiB   | ~2.76k |  ~691 MiB/s   |     ~181M      |

## 512 x 512

The full grid contains **262,144 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~138k |     ~36.2B     |
|           2 | ~146k |     ~38.3B     |
|           4 | ~156k |      ~41B      |
|           8 | ~165k |     ~43.3B     |
|          16 | ~167k |     ~43.8B     |
|          32 | ~185k |     ~48.6B     |

### Recording

| Bit packing | Frame size | Gen/s  | Data volume/s | Cell updates/s |
| ----------: | :--------: | :----: | :-----------: | :------------: |
|           1 |   32 KiB   | ~20.5k |  ~640 MiB/s   |     ~5.37B     |
|           2 |   64 KiB   | ~9.01k |  ~563 MiB/s   |     ~2.36B     |
|           4 |  128 KiB   | ~4.71k |  ~589 MiB/s   |     ~1.23B     |
|           8 |  256 KiB   | ~2.56k |  ~640 MiB/s   |     ~671M      |
|          16 |  512 KiB   | ~1.28k |  ~640 MiB/s   |     ~336M      |
|          32 |   1 MiB    |  ~666  |  ~666 MiB/s   |     ~174M      |

## 1024 x 1024

The full grid contains **1,048,576 cells**.

### Baseline

| Bit packing | Gen/s  | Cell updates/s |
| ----------: | :----: | :------------: |
|           1 | ~53.8k |     ~56.4B     |
|           2 | ~44.8k |     ~46.9B     |
|           4 | ~45.4k |     ~47.6B     |
|           8 | ~48.2k |     ~50.5B     |
|          16 | ~45.9k |     ~48.1B     |
|          32 | ~43.3k |     ~45.4B     |

### Recording

| Bit packing | Frame size | Gen/s  | Data volume/s | Cell updates/s |
| ----------: | :--------: | :----: | :-----------: | :------------: |
|           1 |  128 KiB   | ~5.32k |  ~666 MiB/s   |     ~5.58B     |
|           2 |  256 KiB   | ~2.36k |  ~589 MiB/s   |     ~2.47B     |
|           4 |  512 KiB   | ~1.23k |  ~614 MiB/s   |     ~1.29B     |
|           8 |   1 MiB    |  ~614  |  ~614 MiB/s   |     ~644M      |
|          16 |   2 MiB    |  ~320  |  ~640 MiB/s   |     ~336M      |
|          32 |   4 MiB    |  ~166  |  ~666 MiB/s   |     ~174M      |

## 2048 x 2048

The full grid contains **4,194,304 cells**.

### Baseline

| Bit packing | Gen/s  | Cell updates/s |
| ----------: | :----: | :------------: |
|           1 | ~14.9k |     ~62.6B     |
|           2 | ~13.1k |     ~54.9B     |
|           4 |  ~13k  |     ~54.4B     |
|           8 | ~12.7k |     ~53.4B     |
|          16 |  ~12k  |     ~50.4B     |
|          32 |  ~12k  |     ~50.4B     |

### Recording

| Bit packing | Frame size | Gen/s  | Data volume/s | Cell updates/s |
| ----------: | :--------: | :----: | :-----------: | :------------: |
|           1 |  512 KiB   | ~1.28k |  ~640 MiB/s   |     ~5.37B     |
|           2 |   1 MiB    |  ~563  |  ~563 MiB/s   |     ~2.36B     |
|           4 |   2 MiB    |  ~307  |  ~614 MiB/s   |     ~1.29B     |
|           8 |   4 MiB    |  ~154  |  ~614 MiB/s   |     ~644M      |
|          16 |   8 MiB    |  ~80   |  ~640 MiB/s   |     ~336M      |
|          32 |   16 MiB   | ~41.6  |  ~666 MiB/s   |     ~174M      |

## 4096 x 4096

The full grid contains **16,777,216 cells**.

### Baseline

| Bit packing | Gen/s  | Cell updates/s |
| ----------: | :----: | :------------: |
|           1 | ~4.02k |     ~67.4B     |
|           2 | ~3.3k  |     ~55.4B     |
|           4 | ~3.22k |      ~54B      |
|           8 | ~3.21k |     ~53.9B     |
|          16 | ~3.01k |     ~50.5B     |
|          32 | ~3.02k |     ~50.7B     |

### Recording

| Bit packing | Frame size | Gen/s | Data volume/s | Cell updates/s |
| ----------: | :--------: | :---: | :-----------: | :------------: |
|           1 |   2 MiB    | ~333  |  ~666 MiB/s   |     ~5.58B     |
|           2 |   4 MiB    | ~134  |  ~538 MiB/s   |     ~2.25B     |
|           4 |   8 MiB    | ~73.6 |  ~589 MiB/s   |     ~1.23B     |
|           8 |   16 MiB   | ~38.4 |  ~614 MiB/s   |     ~644M      |
|          16 |   32 MiB   | ~20.8 |  ~666 MiB/s   |     ~349M      |
|          32 |   64 MiB   | ~10.4 |  ~666 MiB/s   |     ~174M      |

## 8192 x 8192

The full grid contains **67,108,864 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~995  |     ~66.7B     |
|           2 | ~821  |     ~55.1B     |
|           4 | ~799  |     ~53.6B     |
|           8 | ~790  |      ~53B      |
|          16 | ~746  |     ~50.1B     |
|          32 | ~744  |     ~49.9B     |

### Recording

| Bit packing | Frame size | Gen/s | Data volume/s | Cell updates/s |
| ----------: | :--------: | :---: | :-----------: | :------------: |
|           1 |   8 MiB    | ~83.2 |  ~666 MiB/s   |     ~5.58B     |
|           2 |   16 MiB   | ~33.6 |  ~538 MiB/s   |     ~2.25B     |
|           4 |   32 MiB   | ~18.4 |  ~589 MiB/s   |     ~1.23B     |
|           8 |   64 MiB   | ~9.6  |  ~614 MiB/s   |     ~644M      |
|          16 |  128 MiB   |  ~5   |  ~640 MiB/s   |     ~336M      |
|          32 |  256 MiB   | ~2.6  |  ~666 MiB/s   |     ~174M      |

## 16384 x 16384

The full grid contains **268,435,456 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~256  |     ~68.7B     |
|           2 | ~206  |     ~55.4B     |
|           4 | ~199  |     ~53.3B     |
|           8 | ~199  |     ~53.4B     |
|          16 | ~187  |     ~50.1B     |
|          32 | ~186  |      ~50B      |

### Recording

| Bit packing | Frame size | Gen/s | Data volume/s | Cell updates/s |
| ----------: | :--------: | :---: | :-----------: | :------------: |
|           1 |   32 MiB   |  ~20  |  ~640 MiB/s   |     ~5.37B     |
|           2 |   64 MiB   | ~8.4  |  ~538 MiB/s   |     ~2.25B     |
|           4 |  128 MiB   | ~4.4  |  ~563 MiB/s   |     ~1.18B     |
|           8 |  256 MiB   | ~2.4  |  ~614 MiB/s   |     ~644M      |
|          16 |  512 MiB   |  ~1   |  ~512 MiB/s   |     ~268M      |
|          32 |   1 GiB    | ~0.6  |  ~614 MiB/s   |     ~161M      |

## 32768 x 32768

The full grid contains **1,073,741,824 cells**.  
16-bit packing uses **32768 x 32767** instead, for **1,073,709,056 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~63.3 |      ~68B      |
|           2 | ~51.5 |     ~55.3B     |
|           4 | ~49.3 |     ~52.9B     |
|           8 | ~49.3 |     ~52.9B     |
|          16 | ~45.2 |     ~48.5B     |

### Recording

| Bit packing | Frame size | Gen/s | Data volume/s | Cell updates/s |
| ----------: | :--------: | :---: | :-----------: | :------------: |
|           1 |  128 MiB   | ~5.2  |  ~666 MiB/s   |     ~5.58B     |
|           2 |  256 MiB   | ~2.3  |  ~589 MiB/s   |     ~2.47B     |
|           4 |  512 MiB   |  ~1   |  ~512 MiB/s   |     ~1.07B     |
|           8 |   1 GiB    | ~0.6  |  ~614 MiB/s   |     ~644M      |

## 65536 x 65536

The full grid contains **4,294,967,296 cells**.  
4-bit packing uses **65536 x 65535** instead, for **4,294,901,760 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~15.8 |     ~67.9B     |
|           2 | ~13.2 |     ~56.7B     |
|           4 |  ~13  |     ~55.8B     |

### Recording

| Bit packing | Frame size | Gen/s | Data volume/s | Cell updates/s |
| ----------: | :--------: | :---: | :-----------: | :------------: |
|           1 |  512 MiB   |  ~1   |  ~512 MiB/s   |     ~4.29B     |
|           2 |   1 GiB    | ~0.6  |  ~614 MiB/s   |     ~2.58B     |

## 131072 x 131072

The full grid contains **17,179,869,184 cells**.  
1-bit packing uses **131072 x 131071** instead, for **17,179,738,112 cells**.

### Baseline

| Bit packing | Gen/s | Cell updates/s |
| ----------: | :---: | :------------: |
|           1 | ~4.8  |     ~82.5B     |

### Recording

No recording run could be recorded for this grid size because the grid is too large for recording.
