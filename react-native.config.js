module.exports = {
  dependencies: {
    'react-native-pdf-thumbnail': {
      platforms: {
        ios: null,
        android: {
          packageImportPath: 'import org.songsterq.pdfthumbnail.PdfThumbnailPackage;',
          packageInstance: 'new PdfThumbnailPackage()',
        },
      },
    },
  },
};
