import os
import tempfile

# Point storage at a throwaway directory BEFORE the app modules are imported.
os.environ["SHAMIR_VAULT_DATA"] = tempfile.mkdtemp(prefix="shamir-vault-test-")
