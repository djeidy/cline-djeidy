import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Note, NoteCollection } from '../../../shared/notes';
import { NoteService } from '../index';

jest.mock('fs/promises');
jest.mock('fs', () => ({
    existsSync: jest.fn()
}));
const mockedFS = fs as jest.Mocked<typeof fs>;

describe('NoteService', () => {
    let noteService: NoteService;
    const mockStoragePath = path.join(process.cwd(), 'test-storage');
    const mockNotesPath = path.join(mockStoragePath, 'notes.json');

    const mockNote: Note = {
        id: 'test-id-1',
        title: 'Test Note',
        content: ['Line 1', 'Line 2'],
        tags: ['test'],
        taskIds: ['task1'],
        timestamp: 1733990765309,
        lastAccessed: 1733990765309
    };

    const mockCollection: NoteCollection = {
        notes: [mockNote],
        version: 1
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock storage directory existence check
        (existsSync as jest.Mock).mockReturnValue(false);
        // Mock directory creation
        mockedFS.mkdir = jest.fn().mockResolvedValue(undefined);
        // Mock empty notes file by default
        mockedFS.readFile = jest.fn().mockRejectedValue(new Error('File not found'));
        // Mock file writing
        mockedFS.writeFile = jest.fn().mockResolvedValue(undefined);

        noteService = new NoteService(mockStoragePath);
    });

    test('creates and retrieves notes', async () => {
        // Mock initial empty collection
        mockedFS.readFile.mockRejectedValueOnce(new Error('File not found'));

        // Test note creation
        await noteService.saveNote(mockNote);
        expect(mockedFS.writeFile).toHaveBeenCalledWith(
            mockNotesPath,
            expect.any(String)
        );

        // Mock successful note retrieval
        mockedFS.readFile.mockResolvedValueOnce(JSON.stringify(mockCollection));

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

        // Mock existing note for context search
        mockedFS.readFile.mockResolvedValueOnce(JSON.stringify({
            notes: [contextNote],
            version: 1
        }));

        const relevantNotes = await noteService.getRelevantNotes('context preservation');
        expect(relevantNotes).toHaveLength(1);
        expect(relevantNotes[0].title).toBe('Context Test Note');
    });

    test('persists notes between sessions', async () => {
        const persistentNote: Note = {
            id: 'persistent-id',
            title: 'Persistent Note',
            content: ['This note should persist'],
            tags: ['persistence'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Mock empty initial state
        mockedFS.readFile.mockRejectedValueOnce(new Error('File not found'));

        // Save note
        await noteService.saveNote(persistentNote);
        expect(mockedFS.writeFile).toHaveBeenCalledWith(
            mockNotesPath,
            expect.stringContaining(persistentNote.title)
        );

        // Mock successful note retrieval for new session
        mockedFS.readFile.mockResolvedValueOnce(JSON.stringify({
            notes: [persistentNote],
            version: 1
        }));

        // Create new service instance
        const newNoteService = new NoteService(mockStoragePath);
        const retrievedCollection = await newNoteService.getNotes();
        expect(retrievedCollection.notes[0]).toEqual(persistentNote);
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

        // Mock empty initial collection
        mockedFS.readFile.mockRejectedValueOnce(new Error('File not found'));


        // Attempt to save large note
        await expect(noteService.saveNote(largeNote)).rejects.toThrow('Notes collection exceeds size limit');
    });

    test('handles errors gracefully', async () => {
        // Mock file system error
        mockedFS.readFile.mockRejectedValueOnce(new Error('Permission denied'));

        // Attempt to read notes
        const collection = await noteService.getNotes();
        expect(collection).toEqual({ notes: [], version: 1 });

        // Verify error doesn't break the service
        const testNote: Note = {
            id: 'test-note',
            title: 'Test Note',
            content: ['Test content'],
            tags: ['test'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Mock successful write
        mockedFS.writeFile.mockResolvedValueOnce(undefined);

        // Should still be able to save notes
        await expect(noteService.saveNote(testNote)).resolves.toBeDefined();
    });
});
