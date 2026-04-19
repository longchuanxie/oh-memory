import Ajv from 'ajv'
import type { PageFrontmatter } from '../types/index.js'

const ajv = new Ajv({ allErrors: true })

const frontmatterSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PageFrontmatter",
  "description": "Schema for oh-memory knowledge page frontmatter",
  "type": "object",
  "required": ["id", "title", "type", "date", "updated", "tags"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the page"
    },
    "title": {
      "type": "string",
      "description": "Title of the page"
    },
    "type": {
      "type": "string",
      "enum": ["entity", "concept", "source", "synthesis"],
      "description": "Type of knowledge page"
    },
    "date": {
      "type": "string",
      "format": "date",
      "description": "Creation date (YYYY-MM-DD)"
    },
    "updated": {
      "type": "string",
      "format": "date",
      "description": "Last update date (YYYY-MM-DD)"
    },
    "connections": {
      "type": "object",
      "properties": {
        "inbound": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of inbound links"
        },
        "outbound": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of outbound links"
        },
        "total": {
          "type": "integer",
          "minimum": 0,
          "description": "Total number of connections"
        }
      },
      "required": ["inbound", "outbound", "total"]
    },
    "category": {
      "type": "string",
      "description": "Category of the page"
    },
    "module": {
      "type": "string",
      "description": "Module this page belongs to"
    },
    "layer": {
      "type": "string",
      "description": "Layer in the architecture"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Tags for categorization"
    },
    "importance": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "Importance level"
    },
    "status": {
      "type": "string",
      "enum": ["active", "deprecated", "draft"],
      "description": "Status of the page"
    },
    "source": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Path to source file"
        },
        "hash": {
          "type": "string",
          "description": "Hash of source file content"
        },
        "lastModified": {
          "type": "string",
          "format": "date-time",
          "description": "Last modification time"
        },
        "lines": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of lines in source file"
        },
        "language": {
          "type": "string",
          "description": "Programming language"
        }
      },
      "required": ["path", "hash", "lastModified", "lines", "language"]
    },
    "relations": {
      "type": "object",
      "properties": {
        "dependsOn": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Pages this page depends on"
        },
        "usedBy": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Pages that use this page"
        },
        "relatedTo": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Related pages"
        }
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "description": {
          "type": "string",
          "description": "Brief description"
        },
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Keywords for search"
        },
        "keyFunctions": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Key functions (for entities)"
        }
      },
      "required": ["description", "keywords"]
    },
    "description": {
      "type": "string",
      "description": "Brief description (deprecated, use summary.description)"
    }
  },
  "additionalProperties": false
}

const validateFrontmatter = ajv.compile(frontmatterSchema)

export function validatePageFrontmatter(frontmatter: unknown): {
  valid: boolean
  errors?: string[]
} {
  const valid = validateFrontmatter(frontmatter)
  
  if (!valid && validateFrontmatter.errors) {
    const errors = validateFrontmatter.errors.map(err => 
      `${err.instancePath} ${err.message}`
    )
    return { valid: false, errors }
  }
  
  return { valid: true }
}

export function createDefaultFrontmatter(
  id: string,
  title: string,
  type: PageFrontmatter['type'],
  options: Partial<PageFrontmatter> = {}
): PageFrontmatter {
  const date = new Date().toISOString().split('T')[0]
  
  return {
    id,
    title,
    type,
    date,
    updated: date,
    tags: [],
    status: 'active',
    importance: 'medium',
    ...options,
  }
}
