/**
 * 🧪 API TESTER - Utilitaires de test pour les APIs
 * Utilisé par APIStatusPanel pour tester la connectivité
 */

export interface APITestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * Test rapide de connectivité
 */
export async function quickConnectivityTest(): Promise<boolean> {
  try {
    // Test simple de connectivité réseau
    const response = await fetch('/', { 
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch (error) {
    console.warn('❌ Test de connectivité échoué:', error);
    return false;
  }
}

/**
 * Test de l'API d'extraction PDF
 */
export async function testPDFExtractionAPI(): Promise<APITestResult> {
  const timestamp = new Date();
  
  try {
    // Test de l'endpoint PDF local
    const localResponse = await fetch('http://localhost:8000/health', {
      method: 'GET'
    });
    
    if (localResponse.ok) {
      return {
        success: true,
        message: 'API PDF locale disponible',
        details: { port: 8000, status: 'active' },
        timestamp
      };
    }
  } catch (localError) {
    console.warn('⚠️ API locale indisponible:', localError);
  }
  
  try {
    // Test de l'API Render
    const renderResponse = await fetch('/api/health', {
      method: 'GET'
    });
    
    if (renderResponse.ok) {
      return {
        success: true,
        message: 'API Render disponible',
        details: { service: 'render', status: 'active' },
        timestamp
      };
    }
  } catch (renderError) {
    console.warn('⚠️ API Render indisponible:', renderError);
  }
  
  return {
    success: false,
    message: 'Aucune API PDF disponible',
    details: { localAPI: 'offline', renderAPI: 'offline' },
    timestamp
  };
}

/**
 * Test avec un fichier utilisateur
 */
/* export async function testWithUserFile(file: File): Promise<APITestResult> {
  const timestamp = new Date();
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/extract-pdf', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        message: `Extraction réussie: ${file.name}`,
        details: { 
          filename: file.name,
          contentLength: result.content?.length || 0,
          extractedContent: result.content?.substring(0, 200) + '...'
        },
        timestamp
      };
    } else {
      return {
        success: false,
        message: `Erreur HTTP ${response.status}`,
        details: { status: response.status, statusText: response.statusText },
        timestamp
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Erreur lors du test',
      details: { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      timestamp
    };
  }
} */

/**
 * Affiche un rapport de test formaté
 */
export function displayTestReport(result: APITestResult): void {
  const icon = result.success ? '✅' : '❌';
  const status = result.success ? 'SUCCÈS' : 'ÉCHEC';
  
  console.log(`\n🧪 === RAPPORT DE TEST API ===`);
  console.log(`${icon} Statut: ${status}`);
  console.log(`📝 Message: ${result.message}`);
  console.log(`⏰ Timestamp: ${result.timestamp.toLocaleString()}`);
  
  if (result.details) {
    console.log(`📊 Détails:`, result.details);
  }
  
  console.log(`═══════════════════════════════\n`);
}
