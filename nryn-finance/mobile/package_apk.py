import os
import shutil
import subprocess
import zipfile

BASE_DIR = r"C:\Users\user5\Downloads\nryn-finance_1\nryn_finance\nryn-finance\mobile"
ORIG_APK = os.path.join(BASE_DIR, r"android\app\build\outputs\apk\release\app-release.apk")
NEW_BUNDLE = os.path.join(BASE_DIR, r"dist_android\index.android.bundle")
KEYSTORE = os.path.join(BASE_DIR, r"android\app\debug.keystore")
BUILD_TOOLS = r"C:\Users\user5\AppData\Local\Android\Sdk\build-tools\35.0.0"
ZIPALIGN = os.path.join(BUILD_TOOLS, "zipalign.exe")
APKSIGNER = os.path.join(BUILD_TOOLS, "apksigner.bat")

OUT_DIR = os.path.join(BASE_DIR, "dist_android")
os.makedirs(OUT_DIR, exist_ok=True)
UNSIGNED_APK = os.path.join(OUT_DIR, "app-clean-unsigned.apk")
ALIGNED_APK = os.path.join(OUT_DIR, "app-clean-aligned.apk")
FINAL_APK = os.path.join(BASE_DIR, "nryn-finance.apk")

print(f"1. Reading original APK: {ORIG_APK}")
print(f"   Bundle to inject: {NEW_BUNDLE} ({os.path.getsize(NEW_BUNDLE):,} bytes)")

# We copy all files from ORIG_APK except:
# - assets/index.android.bundle (replace with NEW_BUNDLE)
# - META-INF/* signatures (strip so apksigner can sign cleanly with v1, v2, v3)
signature_suffixes = ('.SF', '.RSA', '.DSA', '.EC', 'MANIFEST.MF')

with zipfile.ZipFile(ORIG_APK, 'r') as zin:
    with zipfile.ZipFile(UNSIGNED_APK, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            # Skip old bundle
            if item.filename == 'assets/index.android.bundle':
                continue
            # Skip old signatures in META-INF
            if item.filename.startswith('META-INF/') and any(item.filename.endswith(s) for s in signature_suffixes):
                print(f"   Skipping old signature: {item.filename}")
                continue
            # Copy all other entries verbatim with same compression
            data = zin.read(item.filename)
            zout.writestr(item, data)
        
        # Now add the new bundle with standard ZIP_DEFLATED (or STORED if preferred, standard is DEFLATED)
        print("2. Injecting new Hermes bundle...")
        with open(NEW_BUNDLE, 'rb') as f:
            bundle_data = f.read()
        zout.writestr('assets/index.android.bundle', bundle_data, compress_type=zipfile.ZIP_DEFLATED)

print(f"3. Unsigned APK built successfully: {os.path.getsize(UNSIGNED_APK):,} bytes")

# Run zipalign
print("4. Running zipalign (4-byte alignment)...")
if os.path.exists(ALIGNED_APK):
    os.remove(ALIGNED_APK)
res = subprocess.run([ZIPALIGN, "-f", "-p", "4", UNSIGNED_APK, ALIGNED_APK], capture_output=True, text=True)
if res.returncode != 0:
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
    raise RuntimeError(f"zipalign failed with code {res.returncode}")
print(f"   Aligned APK: {os.path.getsize(ALIGNED_APK):,} bytes")

# Run apksigner with BOTH v1 and v2/v3 signing enabled
print("5. Signing APK with apksigner (v1 + v2 + v3 enabled)...")
if os.path.exists(FINAL_APK):
    os.remove(FINAL_APK)

sign_cmd = [
    APKSIGNER, "sign",
    "--ks", KEYSTORE,
    "--ks-pass", "pass:android",
    "--ks-key-alias", "androiddebugkey",
    "--key-pass", "pass:android",
    "--v1-signing-enabled", "true",
    "--v2-signing-enabled", "true",
    "--v3-signing-enabled", "true",
    "--out", FINAL_APK,
    ALIGNED_APK
]
res = subprocess.run(sign_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
    raise RuntimeError(f"apksigner sign failed with code {res.returncode}")

print(f"6. Verifying APK signature...")
verify_cmd = [APKSIGNER, "verify", "--verbose", FINAL_APK]
res = subprocess.run(verify_cmd, capture_output=True, text=True)
print(res.stdout)
if res.returncode != 0:
    raise RuntimeError("apksigner verify failed")

print("7. Checking zipalign on final APK...")
check_align = subprocess.run([ZIPALIGN, "-c", "-v", "4", FINAL_APK], capture_output=True, text=True)
if "Verification succesful" in check_align.stdout or "Verification successful" in check_align.stdout:
    print("   Zipalign verification: SUCCESSFUL")
else:
    print(check_align.stdout[-300:])

# Copy to Downloads
dest1 = r"C:\Users\user5\Downloads\nryn-finance.apk"
dest2 = r"C:\Users\user5\Downloads\nryn-finance_1\nryn-finance.apk"
shutil.copyfile(FINAL_APK, dest1)
shutil.copyfile(FINAL_APK, dest2)
print(f"8. Copied final APK to:\n   {dest1}\n   {dest2}")
print(f"   Final APK size: {os.path.getsize(FINAL_APK) / (1024*1024):.2f} MB")
