/*
 * SPDX-FileCopyrightText: 2024 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { useApplicationState } from '../../../hooks/common/use-application-state'
import { download } from '../../common/download/download'
import { Button, Modal } from 'react-bootstrap'
import { UiIcon } from '../../common/icons/ui-icon'
import { FileEarmarkText as IconMarkdown } from 'react-bootstrap-icons'
import React, { useCallback, useState } from 'react'
import { useTranslatedText } from '../../../hooks/common/use-translated-text'
import { getNote } from '../../../api/notes'

/**
 * Button to export all history entries as a single markdown file.
 */
export const ExportAllMarkdownButton: React.FC = () => {
  const historyEntries = useApplicationState((state) => state.history)
  const buttonTitle = useTranslatedText('landing.history.toolbar.exportAllMarkdown')
  const [show, setShow] = useState(false)
  const [order, setOrder] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(false)

  const openModal = useCallback(() => {
    // Use a Set to avoid duplicate identifiers
    const seen = new Set<string>()
    setOrder(
      historyEntries.filter(entry => {
        if (seen.has(entry.identifier)) return false
        seen.add(entry.identifier)
        return true
      }).map(entry => ({ id: entry.identifier, title: entry.title || 'Untitled' }))
    )
    setShow(true)
  }, [historyEntries])

  const onExportMarkdown = useCallback(async () => {
    setLoading(true)
    const notes = await Promise.all(
      order.map(async (entry) => {
        try {
          const note = await getNote(entry.id)
          return note.content
        } catch {
          return ''
        }
      })
    )
    const combined = notes.filter(Boolean).join('\n---\n\n')
    download(combined, 'all-notes.md', 'text/markdown')
    setLoading(false)
    setShow(false)
  }, [order])

  const onExportPdf = useCallback(async () => {
    setLoading(true)
    const notes = await Promise.all(
      order.map(async (entry) => {
        try {
          const note = await getNote(entry.id)
          return note.content
        } catch {
          return ''
        }
      })
    )
    const combined = notes.filter(Boolean).join('\n---\n\n')
    const { marked } = await import('marked')
    const htmlContent = marked.parse(combined)
    // @ts-ignore: No types for html2pdf.js
    const html2pdf = (await import('html2pdf.js'))
    const html = htmlContent instanceof Promise ? await htmlContent : htmlContent
    const tempDiv = document.createElement('div')
    tempDiv.id = 'export-pdf-temp'
    tempDiv.style.display = 'block'
    tempDiv.style.position = 'fixed'
    tempDiv.style.top = '0'
    tempDiv.style.left = '0'
    tempDiv.style.zIndex = '9999'
    tempDiv.style.background = 'white'
    tempDiv.style.color = 'black'
    tempDiv.style.width = '800px'
    tempDiv.style.padding = '32px'
    tempDiv.style.fontSize = '16px'
    tempDiv.style.fontFamily = 'Arial, sans-serif'
    // Add a style tag to enforce black text and white background
    const style = document.createElement('style')
    style.innerHTML = '* { color: black !important; background: white !important; }'
    tempDiv.innerHTML = `<main>${html}</main>`
    tempDiv.insertBefore(style, tempDiv.firstChild)
    tempDiv.querySelectorAll('*').forEach(el => {
      (el as HTMLElement).style.color = 'black'
      ;(el as HTMLElement).style.background = 'white'
    })
    document.body.appendChild(tempDiv)
    window.scrollTo(0,0)
    await new Promise(r => setTimeout(r, 300))
    const options = {
      margin: 0.5,
      filename: 'all-notes.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#fff', useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      removeContainer: true
    }
    try {
      await html2pdf.default().from(tempDiv).set(options).save()
    } catch (err) {
      // fallback: try html2canvas directly for debugging
      try {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(tempDiv, { backgroundColor: '#fff', scale: 2, useCORS: true })
        const img = canvas.toDataURL('image/png')
        window.open(img, '_blank')
        alert('html2pdf failed, but html2canvas succeeded. See the image in the new tab.')
      } catch (canvasErr) {
        alert('Both html2pdf and html2canvas failed. See console for errors.')
        console.error('html2pdf error:', err)
        console.error('html2canvas error:', canvasErr)
      }
    }
    document.body.removeChild(tempDiv)
    setLoading(false)
    setShow(false)
  }, [order])

  // Draggable list for reordering
  interface DraggableListProps {
    items: { id: string; title: string }[]
    onChange: (items: { id: string; title: string }[]) => void
  }

  const DraggableList: React.FC<DraggableListProps> = ({ items, onChange }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

    const onDragStart = (index: number) => setDraggedIndex(index)
    const onDragOver = (index: number) => {
      if (draggedIndex === null || draggedIndex === index) return
      const updated = [...items]
      const [removed] = updated.splice(draggedIndex, 1)
      updated.splice(index, 0, removed)
      setDraggedIndex(index)
      onChange(updated)
    }
    const onDragEnd = () => setDraggedIndex(null)

    return (
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item, idx) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => { e.preventDefault(); onDragOver(idx) }}
            onDrop={onDragEnd}
            onDragEnd={onDragEnd}
            style={{
              padding: '8px',
              margin: '4px 0',
              background: 'var(--bs-body-bg)', // Use Bootstrap variable for background
              color: 'var(--bs-body-color)', // Use Bootstrap variable for text
              border: '1px solid var(--bs-border-color, #ccc)',
              cursor: 'grab',
              opacity: draggedIndex === idx ? 0.5 : 1,
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
          >
            {item.title}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <Button variant={'secondary'} title={buttonTitle} onClick={openModal}>
        <UiIcon icon={IconMarkdown} />
      </Button>
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{buttonTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Drag and drop to reorder the documents for export:</p>
          <DraggableList items={order} onChange={setOrder} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={onExportMarkdown} disabled={loading}>{loading ? 'Exporting...' : 'Export to Markdown'}</Button>
          <Button variant="primary" onClick={onExportPdf} disabled={loading}>{loading ? 'Exporting...' : 'Export to PDF'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
