# Benchmark Results

The normalized source data for these tables is stored in [`benchmark/benchmark-results.csv`](https://github.com/rChimisso/game-of-life-tribes/blob/main/benchmark/benchmark-results.csv), where the full benchmark values can be checked directly.

The tables report the best observed run out of $3$ repeats. For this kind of benchmark, the best run is often the most useful estimate of how fast the device can execute the workload when background interference is lowest. Slower repeats can still be useful to inspect, but they often include unrelated scheduling, browser, or system activity rather than a slower simulation engine. Since this table reports throughput, the selected value is the highest $\texttt{Gen/s}$ observed for that row.

Columns:

- **Bit packing**: bits used to store each cell in the simulation frame.
- **Frame size**: recording-only raw size of $1$ simulation frame at that grid size and packing.
- **Gen/s**: best observed generations per second during the post-warm-up max-speed window.
- **Cell updates/s**: $\texttt{Gen/s}$ multiplied by the number of cells in the actual measured grid.
- **Data volume/s**: recording-only raw frame volume, computed as $\texttt{Gen/s}\cdot\texttt{frame size}$.

## 128 × 128

The full grid contains **$\mathbf{16\,384}$ cells**.

### Baseline

| Bit packing |        Gen/s        |    Cell updates/s    |
| ----------: | :-----------------: | :------------------: |
|         $1$ | $\sim176\,\text{k}$ | $\sim2.88\,\text{B}$ |
|         $2$ | $\sim307\,\text{k}$ | $\sim5.04\,\text{B}$ |
|         $4$ | $\sim313\,\text{k}$ | $\sim5.13\,\text{B}$ |
|         $8$ | $\sim523\,\text{k}$ | $\sim8.56\,\text{B}$ |
|        $16$ | $\sim523\,\text{k}$ | $\sim8.56\,\text{B}$ |
|        $32$ | $\sim523\,\text{k}$ | $\sim8.56\,\text{B}$ |

### Recording

| Bit packing |   Frame size    |        Gen/s         |     Data volume/s      |    Cell updates/s    |
| ----------: | :-------------: | :------------------: | :--------------------: | :------------------: |
|         $1$ | $2\text{ KiB}$  | $\sim155\,\text{k}$  | $\sim302\text{ MiB/s}$ | $\sim2.53\,\text{B}$ |
|         $2$ | $4\text{ KiB}$  | $\sim123\,\text{k}$  | $\sim480\text{ MiB/s}$ | $\sim2.01\,\text{B}$ |
|         $4$ | $8\text{ KiB}$  | $\sim70.1\,\text{k}$ | $\sim548\text{ MiB/s}$ | $\sim1.15\,\text{B}$ |
|         $8$ | $16\text{ KiB}$ | $\sim38.9\,\text{k}$ | $\sim607\text{ MiB/s}$ | $\sim637\,\text{M}$  |
|        $16$ | $32\text{ KiB}$ | $\sim22.1\,\text{k}$ | $\sim691\text{ MiB/s}$ | $\sim362\,\text{M}$  |
|        $32$ | $64\text{ KiB}$ | $\sim11.5\,\text{k}$ | $\sim717\text{ MiB/s}$ | $\sim188\,\text{M}$  |

## 256 × 256

The full grid contains **$\mathbf{65\,536}$ cells**.

### Baseline

| Bit packing |        Gen/s        |    Cell updates/s    |
| ----------: | :-----------------: | :------------------: |
|         $1$ | $\sim174\,\text{k}$ | $\sim11.4\,\text{B}$ |
|         $2$ | $\sim305\,\text{k}$ |  $\sim20\,\text{B}$  |
|         $4$ | $\sim313\,\text{k}$ | $\sim20.5\,\text{B}$ |
|         $8$ | $\sim313\,\text{k}$ | $\sim20.5\,\text{B}$ |
|        $16$ | $\sim418\,\text{k}$ | $\sim27.4\,\text{B}$ |
|        $32$ | $\sim523\,\text{k}$ | $\sim34.3\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |        Gen/s         |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :------------------: | :--------------------: | :------------------: |
|         $1$ |  $8\text{ KiB}$  | $\sim75.4\,\text{k}$ | $\sim589\text{ MiB/s}$ | $\sim4.94\,\text{B}$ |
|         $2$ | $16\text{ KiB}$  | $\sim36.4\,\text{k}$ | $\sim569\text{ MiB/s}$ | $\sim2.39\,\text{B}$ |
|         $4$ | $32\text{ KiB}$  | $\sim19.7\,\text{k}$ | $\sim614\text{ MiB/s}$ | $\sim1.29\,\text{B}$ |
|         $8$ | $64\text{ KiB}$  | $\sim10.2\,\text{k}$ | $\sim640\text{ MiB/s}$ | $\sim671\,\text{M}$  |
|        $16$ | $128\text{ KiB}$ | $\sim5.53\,\text{k}$ | $\sim691\text{ MiB/s}$ | $\sim362\,\text{M}$  |
|        $32$ | $256\text{ KiB}$ | $\sim2.76\,\text{k}$ | $\sim691\text{ MiB/s}$ | $\sim181\,\text{M}$  |

## 512 × 512

The full grid contains **$\mathbf{262\,144}$ cells**.

### Baseline

| Bit packing |        Gen/s        |    Cell updates/s    |
| ----------: | :-----------------: | :------------------: |
|         $1$ | $\sim138\,\text{k}$ | $\sim36.2\,\text{B}$ |
|         $2$ | $\sim146\,\text{k}$ | $\sim38.3\,\text{B}$ |
|         $4$ | $\sim156\,\text{k}$ |  $\sim41\,\text{B}$  |
|         $8$ | $\sim165\,\text{k}$ | $\sim43.3\,\text{B}$ |
|        $16$ | $\sim167\,\text{k}$ | $\sim43.8\,\text{B}$ |
|        $32$ | $\sim185\,\text{k}$ | $\sim48.6\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |        Gen/s         |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :------------------: | :--------------------: | :------------------: |
|         $1$ | $32\text{ KiB}$  | $\sim20.5\,\text{k}$ | $\sim640\text{ MiB/s}$ | $\sim5.37\,\text{B}$ |
|         $2$ | $64\text{ KiB}$  | $\sim9.01\,\text{k}$ | $\sim563\text{ MiB/s}$ | $\sim2.36\,\text{B}$ |
|         $4$ | $128\text{ KiB}$ | $\sim4.71\,\text{k}$ | $\sim589\text{ MiB/s}$ | $\sim1.23\,\text{B}$ |
|         $8$ | $256\text{ KiB}$ | $\sim2.56\,\text{k}$ | $\sim640\text{ MiB/s}$ | $\sim671\,\text{M}$  |
|        $16$ | $512\text{ KiB}$ | $\sim1.28\,\text{k}$ | $\sim640\text{ MiB/s}$ | $\sim336\,\text{M}$  |
|        $32$ |  $1\text{ MiB}$  |      $\sim666$       | $\sim666\text{ MiB/s}$ | $\sim174\,\text{M}$  |

## 1024 × 1024

The full grid contains **$\mathbf{1\,048\,576}$ cells**.

### Baseline

| Bit packing |        Gen/s         |    Cell updates/s    |
| ----------: | :------------------: | :------------------: |
|         $1$ | $\sim53.8\,\text{k}$ | $\sim56.4\,\text{B}$ |
|         $2$ | $\sim44.8\,\text{k}$ | $\sim46.9\,\text{B}$ |
|         $4$ | $\sim45.4\,\text{k}$ | $\sim47.6\,\text{B}$ |
|         $8$ | $\sim48.2\,\text{k}$ | $\sim50.5\,\text{B}$ |
|        $16$ | $\sim45.9\,\text{k}$ | $\sim48.1\,\text{B}$ |
|        $32$ | $\sim43.3\,\text{k}$ | $\sim45.4\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |        Gen/s         |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :------------------: | :--------------------: | :------------------: |
|         $1$ | $128\text{ KiB}$ | $\sim5.32\,\text{k}$ | $\sim666\text{ MiB/s}$ | $\sim5.58\,\text{B}$ |
|         $2$ | $256\text{ KiB}$ | $\sim2.36\,\text{k}$ | $\sim589\text{ MiB/s}$ | $\sim2.47\,\text{B}$ |
|         $4$ | $512\text{ KiB}$ | $\sim1.23\,\text{k}$ | $\sim614\text{ MiB/s}$ | $\sim1.29\,\text{B}$ |
|         $8$ |  $1\text{ MiB}$  |      $\sim614$       | $\sim614\text{ MiB/s}$ | $\sim644\,\text{M}$  |
|        $16$ |  $2\text{ MiB}$  |      $\sim320$       | $\sim640\text{ MiB/s}$ | $\sim336\,\text{M}$  |
|        $32$ |  $4\text{ MiB}$  |      $\sim166$       | $\sim666\text{ MiB/s}$ | $\sim174\,\text{M}$  |

## 2048 × 2048

The full grid contains **$\mathbf{4\,194\,304}$ cells**.

### Baseline

| Bit packing |        Gen/s         |    Cell updates/s    |
| ----------: | :------------------: | :------------------: |
|         $1$ | $\sim14.9\,\text{k}$ | $\sim62.6\,\text{B}$ |
|         $2$ | $\sim13.1\,\text{k}$ | $\sim54.9\,\text{B}$ |
|         $4$ |  $\sim13\,\text{k}$  | $\sim54.4\,\text{B}$ |
|         $8$ | $\sim12.7\,\text{k}$ | $\sim53.4\,\text{B}$ |
|        $16$ |  $\sim12\,\text{k}$  | $\sim50.4\,\text{B}$ |
|        $32$ |  $\sim12\,\text{k}$  | $\sim50.4\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |        Gen/s         |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :------------------: | :--------------------: | :------------------: |
|         $1$ | $512\text{ KiB}$ | $\sim1.28\,\text{k}$ | $\sim640\text{ MiB/s}$ | $\sim5.37\,\text{B}$ |
|         $2$ |  $1\text{ MiB}$  |      $\sim563$       | $\sim563\text{ MiB/s}$ | $\sim2.36\,\text{B}$ |
|         $4$ |  $2\text{ MiB}$  |      $\sim307$       | $\sim614\text{ MiB/s}$ | $\sim1.29\,\text{B}$ |
|         $8$ |  $4\text{ MiB}$  |      $\sim154$       | $\sim614\text{ MiB/s}$ | $\sim644\,\text{M}$  |
|        $16$ |  $8\text{ MiB}$  |       $\sim80$       | $\sim640\text{ MiB/s}$ | $\sim336\,\text{M}$  |
|        $32$ | $16\text{ MiB}$  |      $\sim41.6$      | $\sim666\text{ MiB/s}$ | $\sim174\,\text{M}$  |

## 4096 × 4096

The full grid contains **$\mathbf{16\,777\,216}$ cells**.

### Baseline

| Bit packing |        Gen/s         |    Cell updates/s    |
| ----------: | :------------------: | :------------------: |
|         $1$ | $\sim4.02\,\text{k}$ | $\sim67.4\,\text{B}$ |
|         $2$ | $\sim3.3\,\text{k}$  | $\sim55.4\,\text{B}$ |
|         $4$ | $\sim3.22\,\text{k}$ |  $\sim54\,\text{B}$  |
|         $8$ | $\sim3.21\,\text{k}$ | $\sim53.9\,\text{B}$ |
|        $16$ | $\sim3.01\,\text{k}$ | $\sim50.5\,\text{B}$ |
|        $32$ | $\sim3.02\,\text{k}$ | $\sim50.7\,\text{B}$ |

### Recording

| Bit packing |   Frame size    |   Gen/s    |     Data volume/s      |    Cell updates/s    |
| ----------: | :-------------: | :--------: | :--------------------: | :------------------: |
|         $1$ | $2\text{ MiB}$  | $\sim333$  | $\sim666\text{ MiB/s}$ | $\sim5.58\,\text{B}$ |
|         $2$ | $4\text{ MiB}$  | $\sim134$  | $\sim538\text{ MiB/s}$ | $\sim2.25\,\text{B}$ |
|         $4$ | $8\text{ MiB}$  | $\sim73.6$ | $\sim589\text{ MiB/s}$ | $\sim1.23\,\text{B}$ |
|         $8$ | $16\text{ MiB}$ | $\sim38.4$ | $\sim614\text{ MiB/s}$ | $\sim644\,\text{M}$  |
|        $16$ | $32\text{ MiB}$ | $\sim20.8$ | $\sim666\text{ MiB/s}$ | $\sim349\,\text{M}$  |
|        $32$ | $64\text{ MiB}$ | $\sim10.4$ | $\sim666\text{ MiB/s}$ | $\sim174\,\text{M}$  |

## 8192 × 8192

The full grid contains **$\mathbf{67\,108\,864}$ cells**.

### Baseline

| Bit packing |   Gen/s   |    Cell updates/s    |
| ----------: | :-------: | :------------------: |
|         $1$ | $\sim995$ | $\sim66.7\,\text{B}$ |
|         $2$ | $\sim821$ | $\sim55.1\,\text{B}$ |
|         $4$ | $\sim799$ | $\sim53.6\,\text{B}$ |
|         $8$ | $\sim790$ |  $\sim53\,\text{B}$  |
|        $16$ | $\sim746$ | $\sim50.1\,\text{B}$ |
|        $32$ | $\sim744$ | $\sim49.9\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |   Gen/s    |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :--------: | :--------------------: | :------------------: |
|         $1$ |  $8\text{ MiB}$  | $\sim83.2$ | $\sim666\text{ MiB/s}$ | $\sim5.58\,\text{B}$ |
|         $2$ | $16\text{ MiB}$  | $\sim33.6$ | $\sim538\text{ MiB/s}$ | $\sim2.25\,\text{B}$ |
|         $4$ | $32\text{ MiB}$  | $\sim18.4$ | $\sim589\text{ MiB/s}$ | $\sim1.23\,\text{B}$ |
|         $8$ | $64\text{ MiB}$  | $\sim9.6$  | $\sim614\text{ MiB/s}$ | $\sim644\,\text{M}$  |
|        $16$ | $128\text{ MiB}$ |  $\sim5$   | $\sim640\text{ MiB/s}$ | $\sim336\,\text{M}$  |
|        $32$ | $256\text{ MiB}$ | $\sim2.6$  | $\sim666\text{ MiB/s}$ | $\sim174\,\text{M}$  |

## 16384 × 16384

The full grid contains **$\mathbf{268\,435\,456}$ cells**.

### Baseline

| Bit packing |   Gen/s   |    Cell updates/s    |
| ----------: | :-------: | :------------------: |
|         $1$ | $\sim256$ | $\sim68.7\,\text{B}$ |
|         $2$ | $\sim206$ | $\sim55.4\,\text{B}$ |
|         $4$ | $\sim199$ | $\sim53.3\,\text{B}$ |
|         $8$ | $\sim199$ | $\sim53.4\,\text{B}$ |
|        $16$ | $\sim187$ | $\sim50.1\,\text{B}$ |
|        $32$ | $\sim186$ |  $\sim50\,\text{B}$  |

### Recording

| Bit packing |    Frame size    |   Gen/s   |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :-------: | :--------------------: | :------------------: |
|         $1$ | $32\text{ MiB}$  | $\sim20$  | $\sim640\text{ MiB/s}$ | $\sim5.37\,\text{B}$ |
|         $2$ | $64\text{ MiB}$  | $\sim8.4$ | $\sim538\text{ MiB/s}$ | $\sim2.25\,\text{B}$ |
|         $4$ | $128\text{ MiB}$ | $\sim4.4$ | $\sim563\text{ MiB/s}$ | $\sim1.18\,\text{B}$ |
|         $8$ | $256\text{ MiB}$ | $\sim2.4$ | $\sim614\text{ MiB/s}$ | $\sim644\,\text{M}$  |
|        $16$ | $512\text{ MiB}$ |  $\sim1$  | $\sim512\text{ MiB/s}$ | $\sim268\,\text{M}$  |
|        $32$ |  $1\text{ GiB}$  | $\sim0.6$ | $\sim614\text{ MiB/s}$ | $\sim161\,\text{M}$  |

## 32768 × 32768

The full grid contains **$\mathbf{1\,073\,741\,824}$ cells**.  
$16$-bit packing uses $\mathbf{32\,768\times32\,767}$ instead, for **$\mathbf{1\,073\,709\,056}$ cells**.

### Baseline

| Bit packing |   Gen/s    |    Cell updates/s    |
| ----------: | :--------: | :------------------: |
|         $1$ | $\sim63.3$ |  $\sim68\,\text{B}$  |
|         $2$ | $\sim51.5$ | $\sim55.3\,\text{B}$ |
|         $4$ | $\sim49.3$ | $\sim52.9\,\text{B}$ |
|         $8$ | $\sim49.3$ | $\sim52.9\,\text{B}$ |
|        $16$ | $\sim45.2$ | $\sim48.5\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |   Gen/s   |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :-------: | :--------------------: | :------------------: |
|         $1$ | $128\text{ MiB}$ | $\sim5.2$ | $\sim666\text{ MiB/s}$ | $\sim5.58\,\text{B}$ |
|         $2$ | $256\text{ MiB}$ | $\sim2.3$ | $\sim589\text{ MiB/s}$ | $\sim2.47\,\text{B}$ |
|         $4$ | $512\text{ MiB}$ |  $\sim1$  | $\sim512\text{ MiB/s}$ | $\sim1.07\,\text{B}$ |
|         $8$ |  $1\text{ GiB}$  | $\sim0.6$ | $\sim614\text{ MiB/s}$ | $\sim644\,\text{M}$  |

## 65536 × 65536

The full grid contains **$\mathbf{4\,294\,967\,296}$ cells**.  
$4$-bit packing uses $\mathbf{65\,536\times65\,535}$ instead, for **$\mathbf{4\,294\,901\,760}$ cells**.

### Baseline

| Bit packing |   Gen/s    |    Cell updates/s    |
| ----------: | :--------: | :------------------: |
|         $1$ | $\sim15.8$ | $\sim67.9\,\text{B}$ |
|         $2$ | $\sim13.2$ | $\sim56.7\,\text{B}$ |
|         $4$ |  $\sim13$  | $\sim55.8\,\text{B}$ |

### Recording

| Bit packing |    Frame size    |   Gen/s   |     Data volume/s      |    Cell updates/s    |
| ----------: | :--------------: | :-------: | :--------------------: | :------------------: |
|         $1$ | $512\text{ MiB}$ |  $\sim1$  | $\sim512\text{ MiB/s}$ | $\sim4.29\,\text{B}$ |
|         $2$ |  $1\text{ GiB}$  | $\sim0.6$ | $\sim614\text{ MiB/s}$ | $\sim2.58\,\text{B}$ |

## 131072 × 131072

The full grid contains **$\mathbf{17\,179\,869\,184}$ cells**.  
$1$-bit packing uses $\mathbf{131\,072\times131\,071}$ instead, for **$\mathbf{17\,179\,738\,112}$ cells**.

### Baseline

| Bit packing |   Gen/s   |    Cell updates/s    |
| ----------: | :-------: | :------------------: |
|         $1$ | $\sim4.8$ | $\sim82.5\,\text{B}$ |

### Recording

No recording run could be recorded for this grid size because it is too large to enable recording.
