
echo ""

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Usage: ./decrypt-envs.sh [filename] [passphrase] argument is missing ❌"
    exit 1
fi

passphrase="$2"
stage="$3"
# $3 third variable is just for stage in message

# it will encrypt all the envs and create .gpg file
echo "🔓 decryption of all $stage envs "
find . -type f -name "$1.gpg" | while read -r file; do
    original_file="${file%.*}"  # Remove the .gpg extension
    echo "🔓 Decrypting $file to $original_file..."
    echo "$passphrase" | gpg --batch --yes --passphrase-fd 0 -o "$original_file" -d "$file"
    echo "✅ Decrypted $file to $original_file"
done
echo "✅ all $stage envs are decrypted!! "
echo ""
