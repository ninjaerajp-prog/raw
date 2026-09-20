#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <string.h>

/* Trailer layout appended by the server:
 *   [script bytes][uint32 little-endian length][8-byte magic "CMD2EXE1"]
 */

static const char g_magic[8] = { 'C', 'M', 'D', '2', 'E', 'X', 'E', '1' };

static void get_exe_dir(wchar_t *dir, DWORD cch)
{
    DWORD n = GetModuleFileNameW(NULL, dir, cch);
    if (n == 0 || n >= cch) {
        dir[0] = L'.';
        dir[1] = L'\0';
        return;
    }
    for (DWORD i = n; i > 0; --i) {
        if (dir[i - 1] == L'\\' || dir[i - 1] == L'/') {
            dir[i - 1] = L'\0';
            return;
        }
    }
    dir[0] = L'.';
    dir[1] = L'\0';
}

static int read_appended_script(unsigned char **out_buf, DWORD *out_len)
{
    wchar_t exe_path[MAX_PATH];
    DWORD n = GetModuleFileNameW(NULL, exe_path, MAX_PATH);
    if (n == 0 || n >= MAX_PATH)
        return 0;

    HANDLE h = CreateFileW(
        exe_path,
        GENERIC_READ,
        FILE_SHARE_READ,
        NULL,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        NULL);
    if (h == INVALID_HANDLE_VALUE)
        return 0;

    LARGE_INTEGER size;
    if (!GetFileSizeEx(h, &size) || size.QuadPart < 12) {
        CloseHandle(h);
        return 0;
    }

    char magic[8];
    DWORD read = 0;
    LARGE_INTEGER pos;
    pos.QuadPart = size.QuadPart - 8;
    if (!SetFilePointerEx(h, pos, NULL, FILE_BEGIN) ||
        !ReadFile(h, magic, 8, &read, NULL) ||
        read != 8 ||
        memcmp(magic, g_magic, 8) != 0) {
        CloseHandle(h);
        return 0;
    }

    DWORD script_len = 0;
    pos.QuadPart = size.QuadPart - 12;
    if (!SetFilePointerEx(h, pos, NULL, FILE_BEGIN) ||
        !ReadFile(h, &script_len, 4, &read, NULL) ||
        read != 4 ||
        script_len == 0 ||
        (ULONGLONG)script_len + 12 > (ULONGLONG)size.QuadPart) {
        CloseHandle(h);
        return 0;
    }

    unsigned char *buf = (unsigned char *)HeapAlloc(GetProcessHeap(), 0, script_len);
    if (!buf) {
        CloseHandle(h);
        return 0;
    }

    pos.QuadPart = size.QuadPart - 12 - (LONGLONG)script_len;
    if (!SetFilePointerEx(h, pos, NULL, FILE_BEGIN) ||
        !ReadFile(h, buf, script_len, &read, NULL) ||
        read != script_len) {
        HeapFree(GetProcessHeap(), 0, buf);
        CloseHandle(h);
        return 0;
    }

    CloseHandle(h);
    *out_buf = buf;
    *out_len = script_len;
    return 1;
}

static int write_temp_script(const unsigned char *data, DWORD len, wchar_t *out_path, DWORD cch)
{
    wchar_t temp_dir[MAX_PATH];
    DWORD n = GetTempPathW(MAX_PATH, temp_dir);
    if (n == 0 || n >= MAX_PATH)
        return 0;

    UINT u = GetTempFileNameW(temp_dir, L"c2e", 0, out_path);
    if (u == 0)
        return 0;

    DeleteFileW(out_path);
    size_t path_len = wcslen(out_path);
    if (path_len >= 4) {
        out_path[path_len - 3] = L'c';
        out_path[path_len - 2] = L'm';
        out_path[path_len - 1] = L'd';
    }

    HANDLE h = CreateFileW(
        out_path,
        GENERIC_WRITE,
        0,
        NULL,
        CREATE_ALWAYS,
        FILE_ATTRIBUTE_NORMAL,
        NULL);
    if (h == INVALID_HANDLE_VALUE)
        return 0;

    DWORD written = 0;
    BOOL ok = WriteFile(h, data, len, &written, NULL);
    CloseHandle(h);
    return ok && written == len;
}

static void schedule_self_delete(void)
{
    wchar_t exe_path[MAX_PATH];
    DWORD n = GetModuleFileNameW(NULL, exe_path, MAX_PATH);
    if (n == 0 || n >= MAX_PATH)
        return;

    wchar_t del_cmd[MAX_PATH * 2 + 160];
    if (_snwprintf(
            del_cmd,
            MAX_PATH * 2 + 160,
            L"cmd.exe /c \"for /l %%i in (1,1,100) do @((del /f /q \"%s\" >nul 2>&1 && exit /b 0) & ping 127.0.0.1 -n 1 >nul)\"",
            exe_path) < 0) {
        return;
    }

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    ZeroMemory(&pi, sizeof(pi));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    if (CreateProcessW(
            NULL,
            del_cmd,
            NULL,
            NULL,
            FALSE,
            CREATE_NO_WINDOW,
            NULL,
            NULL,
            &si,
            &pi)) {
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
    }
}

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE hp, LPWSTR cmd, int show)
{
    (void)hi; (void)hp; (void)cmd; (void)show;

    unsigned char *script = NULL;
    DWORD script_len = 0;
    if (!read_appended_script(&script, &script_len))
        return 1;

    wchar_t script_path[MAX_PATH];
    if (!write_temp_script(script, script_len, script_path, MAX_PATH)) {
        HeapFree(GetProcessHeap(), 0, script);
        return 1;
    }
    HeapFree(GetProcessHeap(), 0, script);

    wchar_t exe_dir[MAX_PATH];
    get_exe_dir(exe_dir, MAX_PATH);

    wchar_t cmdline[MAX_PATH * 2 + 32];
    if (_snwprintf(cmdline, MAX_PATH * 2 + 32, L"cmd.exe /c \"%s\"", script_path) < 0) {
        DeleteFileW(script_path);
        return 1;
    }

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    ZeroMemory(&pi, sizeof(pi));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    BOOL created = CreateProcessW(
        NULL,
        cmdline,
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW,
        NULL,
        exe_dir,
        &si,
        &pi);

    int exit_code = 1;
    if (created) {
        WaitForSingleObject(pi.hProcess, INFINITE);
        DWORD code = 0;
        if (GetExitCodeProcess(pi.hProcess, &code))
            exit_code = (int)code;
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
    }

    DeleteFileW(script_path);
    schedule_self_delete();
    return exit_code;
}
