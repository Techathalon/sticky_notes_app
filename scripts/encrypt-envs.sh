echo ""

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "❌ Usage: ./encrypt-envs.sh [filename] [passphrase] [stage] argument is missing ❌"
    exit 1
fi

passphrase="$2"
stage="$3"

echo "🔒 Checking and encrypting $stage envs..."
find . -type f -name "$1" | while read -r file; do
    encrypted_file="$file.gpg"
    temp_decrypted_file=$(mktemp)

    # Check if the encrypted file doesn't exist
    if [ ! -e "$encrypted_file" ]; then
        echo "🔒 Encrypting $file..."
        echo "$passphrase" | gpg --batch --yes --passphrase-fd 0 -c -o "$encrypted_file" "$file"
        echo "✅ Encrypted $file to $encrypted_file"
    else
        # Decrypt to a temporary file for comparison
        gpg --decrypt --batch --yes --passphrase "$passphrase" -o "$temp_decrypted_file" "$encrypted_file"

        # Check if the content is different
        if ! cmp -s "$file" "$temp_decrypted_file"; then
            echo "🔒 Encrypting $file..."
            echo "$passphrase" | gpg --batch --yes --passphrase-fd 0 -c -o "$encrypted_file" "$file"
            echo "✅ Encrypted $file to $encrypted_file"
        else
            echo "✅ Content of $file unchanged, skipping encryption."
        fi

        # Remove the temporary decrypted file
        rm -f "$temp_decrypted_file"
    fi
done

echo "✅ Checked and encrypted $stage envs!!"
echo ""
