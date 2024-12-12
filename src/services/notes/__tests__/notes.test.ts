import { Note, NoteCollection } from '../../../shared/notes';
import { NoteService } from '../index';

describe('NoteService', () => {
    let noteService: NoteService;
    const mockNote: Note = {
        id: 'test-id-1',
        title: 'Test Note',
        content: ['Line 1', 'Line 2'],
        tags: ['test'],
        taskIds: ['task1'],
        timestamp: 1733990765309,
        lastAccessed: 1733990765309
    };

    beforeEach(() => {
        noteService = new NoteService();
    });

    test('creates and retrieves notes', async () => {
        // Test note creation
        await noteService.saveNote(mockNote);

        // Test note retrieval
        const collection = await noteService.getNotes();
        expect(collection.notes).toHaveLength(1);
        expect(collection.notes[0]).toEqual(mockNote);
    });

    test('finds relevant notes for context', async () => {
        const contextNote: Note = {
            id: 'context-note',
            title: 'Context Test Note',
            content: ['This note is about context preservation'],
            tags: ['context', 'preservation'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Save note for context search
        await noteService.saveNote(contextNote);

        const relevantNotes = await noteService.getRelevantNotes('context preservation');
        expect(relevantNotes).toHaveLength(1);
        expect(relevantNotes[0].title).toBe('Context Test Note');
    });

    test('respects token limits', async () => {
        // Create a large note that exceeds size limit
        const largeNote: Note = {
            id: 'large-note',
            title: 'Large Note',
            content: Array(100000).fill('This is a very long line of text that will contribute to the overall size and definitely exceed the 1MB limit when combined with other note metadata'),
            tags: ['large'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Attempt to save large note
        await expect(noteService.saveNote(largeNote)).rejects.toThrow('Notes collection exceeds size limit');
    });

    test('handles errors gracefully', async () => {
        // Test error handling with invalid note
        const invalidNote = {
            ...mockNote,
            content: undefined // This will cause JSON.stringify to fail
        } as unknown as Note;

        // Should handle error and return note
        const result = await noteService.saveNote(invalidNote);
        expect(result).toBeDefined();

        // Verify service still works
        const testNote: Note = {
            id: 'test-note',
            title: 'Test Note',
            content: ['Test content'],
            tags: ['test'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Should still be able to save notes
        await expect(noteService.saveNote(testNote)).resolves.toBeDefined();
    });

    test('updates existing notes', async () => {
        // Save initial note
        await noteService.saveNote(mockNote);

        // Update note
        const updatedNote = {
            ...mockNote,
            title: 'Updated Title',
            content: ['Updated content']
        };

        await noteService.saveNote(updatedNote);

        // Verify update
        const collection = await noteService.getNotes();
        expect(collection.notes).toHaveLength(1);
        expect(collection.notes[0].title).toBe('Updated Title');
        expect(collection.notes[0].content).toEqual(['Updated content']);
    });

    test('searches notes by content and tags', async () => {
        const searchNote1: Note = {
            id: 'search-1',
            title: 'Search Test One',
            content: ['This is a test note about searching'],
            tags: ['search', 'test'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        const searchNote2: Note = {
            id: 'search-2',
            title: 'Another Note',
            content: ['This note is not about searching'],
            tags: ['other'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Save test notes
        await noteService.saveNote(searchNote1);
        await noteService.saveNote(searchNote2);

        // Search notes
        const results = await noteService.searchNotes('search test');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('search-1');
    });
});
