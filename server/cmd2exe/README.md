# CMD → silent EXE packer

Railway runs Linux and cannot use the original `cmdexe.py` + local MinGW flow at request time.

This module keeps the same runtime behavior:

1. A prebuilt Windows GUI stub (`stub.exe`) extracts an appended `.cmd` script
2. Runs it with `CREATE_NO_WINDOW` (no console flash)
3. Deletes the temp script and schedules self-delete of the exe

## Layout

| File | Purpose |
| --- | --- |
| `stub.c` | Windows stub source (overlay trailer reader) |
| `stub.exe` | Prebuilt PE stub committed for Linux/Railway packaging |
| `index.js` | Node packer: `stub + script + length + magic` |
| `build-stub.cmd` | Rebuild `stub.exe` on a Windows machine with MinGW |

## Rebuild stub (Windows + MinGW only)

```bat
server\cmd2exe\build-stub.cmd
```

Runtime downloads never invoke a compiler.
