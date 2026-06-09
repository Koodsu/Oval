import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface ExportTextFileOptions {
  filename: string;
  contents: string;
  mimeType: string;
  title: string;
  uti?: string;
}

export async function exportTextFile({
  filename,
  contents,
  mimeType,
  title,
  uti,
}: ExportTextFileOptions): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (FileSystem.cacheDirectory && await Sharing.isAvailableAsync()) {
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri, {
      dialogTitle: title,
      mimeType,
      UTI: uti,
    });
    return;
  }

  await Share.share({ title, message: contents });
}
