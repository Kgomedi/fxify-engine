// netlify/functions/create-doc.js
// Creates a Google Doc from generated draft content
// Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID
// in Netlify environment variables

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json()
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data))
  return data.access_token
}

async function createGoogleDoc(accessToken, title, content, folderId) {
  // Step 1: Create the document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })
  const doc = await createRes.json()
  if (!doc.documentId) throw new Error('Failed to create doc: ' + JSON.stringify(doc))
  const docId = doc.documentId

  // Step 2: Write content into the document
  // Parse content into structured requests for Google Docs API
  const requests = buildDocRequests(content)
  if (requests.length > 0) {
    await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    })
  }

  // Step 3: Move doc to FXIFY content folder
  if (folderId) {
    // Get current parents
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?fields=parents`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const fileData = await fileRes.json()
    const currentParents = fileData.parents ? fileData.parents.join(',') : ''

    await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}?addParents=${folderId}&removeParents=${currentParents}&fields=id,parents`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
  }

  // Step 4: Share with domain (anyone at fxify.com can view/edit)
  await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'domain',
      role: 'writer',
      domain: 'fxify.com',
    }),
  })

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
    embedUrl: `https://docs.google.com/document/d/${docId}/edit?rm=embedded`,
  }
}

function buildDocRequests(content) {
  // Build Google Docs batchUpdate requests from plain text/markdown content
  const requests = []
  const lines = content.split('\n').filter(l => l.trim())
  let index = 1 // Google Docs content starts at index 1

  // Insert all text first as one block, then apply formatting
  const fullText = lines.join('\n') + '\n'
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  })

  // Apply heading styles based on markdown markers
  let currentIndex = 1
  lines.forEach(line => {
    const len = line.length + 1 // +1 for newline
    if (line.startsWith('# ')) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex, endIndex: currentIndex + len },
          paragraphStyle: { namedStyleType: 'HEADING_1' },
          fields: 'namedStyleType',
        },
      })
    } else if (line.startsWith('## ')) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex, endIndex: currentIndex + len },
          paragraphStyle: { namedStyleType: 'HEADING_2' },
          fields: 'namedStyleType',
        },
      })
    } else if (line.startsWith('### ')) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentIndex, endIndex: currentIndex + len },
          paragraphStyle: { namedStyleType: 'HEADING_3' },
          fields: 'namedStyleType',
        },
      })
    }
    currentIndex += len
  })

  return requests
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const { title, content } = JSON.parse(event.body)
    if (!title || !content) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'title and content required' }) }
    }

    const accessToken = await getAccessToken()
    const doc = await createGoogleDoc(
      accessToken,
      title,
      content,
      process.env.GOOGLE_DRIVE_FOLDER_ID
    )

    return { statusCode: 200, headers, body: JSON.stringify(doc) }
  } catch (err) {
    console.error('create-doc error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create doc', detail: err.message }),
    }
  }
}
