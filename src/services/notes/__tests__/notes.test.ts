import { NoteService } from '../index';
import { Note, NoteCollection } from '../../../shared/notes';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';

type MockedFS = {
    promises: {
        mkdir: Mock<(path: string) => Promise<void>>;
        writeFile: Mock<(path: string, data: string) => Promise<void>>;
        readFile: Mock<(path: string) => Promise<string>>;
        readdir: Mock<(path: string) => Promise<string[]>>;
    };
    existsSync: Mock<(path: string) => boolean>;
};

jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        readdir: jest.fn(),
    },
    existsSync: jest.fn(),
}));

const mockedFS = fs as unknown as MockedFS;

describe('NoteService', () => {
    let noteService: NoteService;
    const mockStoragePath = '/mock/storage/path';

    beforeEach(() => {
        jest.clearAllMocks();
        noteService = new NoteService(mockStoragePath);
    });

    test('creates and retrieves notes', async () => {
        const mockNote: Note = {
            id: crypto.randomUUID(),
            title: 'Test Note',
            content: ['Line 1', 'Line 2'],
            tags: ['test'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        const mockCollection: NoteCollection = {
            notes: [mockNote],
            version: 1
        };

        // Mock file system operations
        mockedFS.existsSync.mockReturnValue(true);
        mockedFS.promises.writeFile.mockResolvedValue(undefined);
        mockedFS.promises.readFile.mockResolvedValue(JSON.stringify(mockCollection));

        // Test note creation
        await noteService.saveNote(mockNote);
        expect(mockedFS.promises.writeFile).toHaveBeenCalledWith(
            expect.stringContaining('notes.json'),
            expect.any(String)
        );

        // Test note retrieval
        const retrievedCollection = await noteService.getNotes();
        expect(retrievedCollection.notes[0]).toEqual(mockNote);
    });

    test('finds relevant notes for context', async () => {
        const mockNotes: Note[] = [
            {
                id: crypto.randomUUID(),
                title: 'Context Test Note',
                content: ['This is a test note about context preservation'],
                tags: ['context'],
                taskIds: ['task1'],
                timestamp: Date.now(),
                lastAccessed: Date.now()
            },
            {
                id: crypto.randomUUID(),
                title: 'Unrelated Note',
                content: ['This note is about something else'],
                tags: ['other'],
                taskIds: ['task2'],
                timestamp: Date.now(),
                lastAccessed: Date.now()
            }
        ];

        const mockCollection: NoteCollection = {
            notes: mockNotes,
            version: 1
        };

        // Mock file system operations
        mockedFS.existsSync.mockReturnValue(true);
        mockedFS.promises.readFile.mockResolvedValue(JSON.stringify(mockCollection));

        const relevantNotes = await noteService.getRelevantNotes('context preservation');
        expect(relevantNotes).toHaveLength(1);
        expect(relevantNotes[0].title).toBe('Context Test Note');
    });

    test('persists notes between sessions', async () => {
        const mockNote: Note = {
            id: crypto.randomUUID(),
            title: 'Persistent Note',
            content: ['This note should persist'],
            tags: ['persistence'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        const mockCollection: NoteCollection = {
            notes: [mockNote],
            version: 1
        };

        // Mock file system operations for first "session"
        mockedFS.existsSync.mockReturnValue(true);
        mockedFS.promises.writeFile.mockResolvedValue(undefined);
        mockedFS.promises.readFile.mockResolvedValue(JSON.stringify(mockCollection));

        // Save note in first "session"
        await noteService.saveNote(mockNote);

        // Create new service instance to simulate new session
        const newNoteService = new NoteService(mockStoragePath);

        // Try to retrieve note in new "session"
        const retrievedCollection = await newNoteService.getNotes();
        expect(retrievedCollection.notes[0]).toEqual(mockNote);
    });

    test('respects token limits', async () => {
        // Create a note that would exceed token limit (1MB)
        const largeContent = 'x'.repeat(1024 * 1024 + 1); // Slightly over 1MB
        const mockNote: Note = {
            id: crypto.randomUUID(),
            title: 'Large Note',
            content: [largeContent],
            tags: ['large'],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Mock file system operations
        mockedFS.existsSync.mockReturnValue(true);
        mockedFS.promises.writeFile.mockResolvedValue(undefined);

        // Attempt to save large note
        await expect(noteService.saveNote(mockNote)).rejects.toThrow('Notes collection exceeds size limit');
    });

    test('handles errors gracefully', async () => {
        // Mock file system error
        mockedFS.existsSync.mockReturnValue(true);
        mockedFS.promises.readFile.mockRejectedValue(new Error('File system error'));

        // Attempt to read notes
        const collection = await noteService.getNotes();
        expect(collection).toEqual({ notes: [], version: 1 });

        // Verify error doesn't break the service
        const mockNote: Note = {
            id: crypto.randomUUID(),
            title: 'New Note',
            content: ['Content'],
            tags: [],
            taskIds: ['task1'],
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        // Service should still be able to save new notes
        mockedFS.promises.writeFile.mockResolvedValue(undefined);
        await noteService.saveNote(mockNote);
        expect(mockedFS.promises.writeFile).toHaveBeenCalled();
    });
});
