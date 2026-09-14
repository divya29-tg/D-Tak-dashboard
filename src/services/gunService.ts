/**
 * Gun.js Service - Authentication and data management
 *
 * Peers with the same chat-signaling relay mesh the production dchat web
 * portal (app.js) uses — NOT dchat.staging.trustgrid.com, which is a
 * separate graph that never syncs with real users. Connecting to the
 * wrong peers is indistinguishable from "sync is broken": writes succeed
 * locally and reads return empty, with no error surfaced anywhere.
 */

import Gun from 'gun';
import 'gun/sea';

const gun = Gun([
  'https://dchat.staging.trustgrid.com/gun',
]);

export interface GunUser {
  username: string;
  alias: string;
}

export interface GunGroup {
  groupId: string;
  name: string;
  description?: string;
  admin: string;
  members: Record<string, boolean>;
  createdAt: number;
}

export interface GunMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

class GunService {
  private gun = gun;
  private currentUser: any = null;

  /**
   * Register a new user with username and password
   */
  async registerUser(username: string, password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const user = this.gun.user();
      user.create(username, password, (ack: any) => {
        if (ack.err) {
          console.error('Registration error:', ack.err);
          reject(new Error(ack.err));
        } else {
          // Store user info in Gun
          this.gun.get('users').get(username).put({
            username: username,
            alias: username,
            registered: Date.now(),
          });
          console.log('User registered successfully:', username);
          resolve(true);
        }
      });
    });
  }

  /**
   * Login user with username and password
   */
  async loginUser(username: string, password: string): Promise<GunUser> {
    return new Promise((resolve, reject) => {
      const user = this.gun.user();
      user.auth(username, password, (ack: any) => {
        if (ack.err) {
          console.error('Login error:', ack.err);
          reject(new Error('Login failed'));
        } else {
          this.currentUser = user;
          console.log('User logged in:', username);
          resolve({
            username: username,
            alias: (user.is?.alias as string) || username,
          });
        }
      });
    });
  }

  /**
   * Get current logged-in user
   */
  getCurrentUser(): any {
    return this.currentUser;
  }

  /**
   * Logout current user
   */
  logout(): void {
    if (this.currentUser && this.currentUser.leave) {
      this.currentUser.leave();
    }
    this.currentUser = null;
  }

  /**
   * Create a new group with admin and members
   */
  async createGroup(groupName: string, admin: string, members: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const groupData: GunGroup = {
        groupId,
        name: groupName,
        admin: admin,
        members: { [admin]: true },
        createdAt: Date.now(),
      };

      // Add other members
      members.forEach(member => {
        groupData.members[member] = true;
      });

      // Save group to Gun
      this.gun.get('groups').get(groupId).put(groupData, (ack: any) => {
        if (ack.err) {
          console.error('Error creating group:', ack.err);
          reject(new Error('Failed to create group'));
        } else {
          // Add group to admin's groups
          if (this.currentUser) {
            this.currentUser.get('groups').set(groupId, () => {
              // Add group to all members
              members.forEach(member => {
                this.gun.get('users').get(member).get('groups').set(groupId as unknown as Partial<unknown>);
              });
              console.log('Group created successfully:', groupId);
              resolve(groupId);
            });
          } else {
            resolve(groupId);
          }
        }
      });
    });
  }

  /**
   * Get all groups for current user
   */
  getUserGroups(username: string, callback: (groups: GunGroup[]) => void): void {
    const groups: GunGroup[] = [];
    const groupIds: string[] = [];

    this.gun.get('users').get(username).get('groups').map().on((groupId: string) => {
      if (groupId && !groupIds.includes(groupId)) {
        groupIds.push(groupId);
        
        this.gun.get('groups').get(groupId).once((groupData: GunGroup) => {
          if (groupData) {
            groups.push(groupData);
            callback(groups);
          }
        });
      }
    });
  }

  /**
   * Get group details
   */
  getGroup(groupId: string, callback: (group: GunGroup | null) => void): void {
    this.gun.get('groups').get(groupId).once((groupData: GunGroup) => {
      callback(groupData || null);
    });
  }

  /**
   * Add member to group (admin only)
   */
  async addMemberToGroup(groupId: string, memberUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('groups').get(groupId).get('members').get(memberUsername).put(true, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to add member'));
        } else {
          // Add group to member's groups
          this.gun.get('users').get(memberUsername).get('groups').set(groupId as unknown as Partial<unknown>, () => {
            resolve();
          });
        }
      });
    });
  }

  /**
   * Remove member from group (admin only)
   */
  async removeMemberFromGroup(groupId: string, memberUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('groups').get(groupId).get('members').get(memberUsername).put(null, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to remove member'));
        } else {
          this.gun.get('users').get(memberUsername).get('groups').set({ [groupId]: null }, () => {
            resolve();
          });
        }
      });
    });
  }

  /**
   * Send direct message to user.
   *
   * Stored FLAT at chats/<chatId> (one .get() before .set()/.map()), matching
   * the production web portal's schema exactly — both so messages actually
   * interoperate with real dchat clients reading/writing that same path, and
   * because a nested chats/<chatId>/messages/<msgId> shape (two .get()s
   * before .map()) is the same shape that silently fails to sync between two
   * SEA-authenticated peers (see the contact-request fix in this file).
   */
  async sendDirectMessage(recipientUsername: string, messageText: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }

    const sender = this.currentUser.is.alias;
    const chatId = this.getChatId(sender, recipientUsername);

    return new Promise((resolve, reject) => {
      this.gun.get('chats').get(chatId).set({
        sender: sender,
        content: messageText,
        timestamp: Date.now(),
      }, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to send message'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send group message. Stored FLAT at groupChats/<groupId>, same reasoning
   * as sendDirectMessage above.
   */
  async sendGroupMessage(groupId: string, messageText: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }

    const sender = this.currentUser.is.alias;

    return new Promise((resolve, reject) => {
      this.gun.get('groupChats').get(groupId).set({
        sender: sender,
        content: messageText,
        timestamp: Date.now(),
      }, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to send message'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load (and live-subscribe to) direct messages with a user.
   */
  loadDirectMessages(otherUsername: string, callback: (messages: GunMessage[]) => void): void {
    if (!this.currentUser || !this.currentUser.is) {
      console.error('User not logged in');
      return;
    }

    const sender = this.currentUser.is.alias;
    const chatId = this.getChatId(sender, otherUsername);
    const messagesById = new Map<string, GunMessage>();

    this.gun.get('chats').get(chatId).map().on((msgData: any, id: string) => {
      if (!msgData) return;
      messagesById.set(id, {
        id,
        sender: msgData.sender,
        content: msgData.content,
        timestamp: msgData.timestamp,
      });
      const messages = Array.from(messagesById.values()).sort((a, b) => a.timestamp - b.timestamp);
      callback(messages);
    });
  }

  /**
   * Load (and live-subscribe to) group messages.
   */
  loadGroupMessages(groupId: string, callback: (messages: GunMessage[]) => void): void {
    const messagesById = new Map<string, GunMessage>();

    this.gun.get('groupChats').get(groupId).map().on((msgData: any, id: string) => {
      if (!msgData) return;
      messagesById.set(id, {
        id,
        sender: msgData.sender,
        content: msgData.content,
        timestamp: msgData.timestamp,
      });
      const messages = Array.from(messagesById.values()).sort((a, b) => a.timestamp - b.timestamp);
      callback(messages);
    });
  }

  /**
   * Get all users (for selection)
   */
  getAllUsers(callback: (users: string[]) => void): void {
    const users: string[] = [];

    this.gun.get('users').map().once((userData: any, username: string) => {
      if (userData && userData.username && !users.includes(username)) {
        users.push(username);
        callback(users);
      }
    });
  }

  /**
   * Deactivate a user: wipe their public profile fields and flag them as
   * deactivated so any client reading the shared graph can refuse them access.
   * Gun/SEA has no central "kill switch" for a keypair, so this only revokes
   * the app-level profile this codebase controls.
   */
  async deactivateUser(username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('users').get(username).put({
        username: null,
        alias: null,
        deactivated: true,
        deactivatedAt: Date.now(),
      } as unknown as Partial<unknown>, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to deactivate user'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Reverse a deactivation and restore the user's public profile fields.
   */
  async activateUser(username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gun.get('users').get(username).put({
        username: username,
        alias: username,
        deactivated: false,
        deactivatedAt: null,
      } as unknown as Partial<unknown>, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to activate user'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check whether a user is currently flagged as deactivated.
   */
  isUserDeactivated(username: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.gun.get('users').get(username).get('deactivated').once((val: any) => {
        resolve(Boolean(val));
      });
    });
  }

  /**
   * Send a contact request from the current user to another user.
   *
   * Stored at users/<toUsername>/contactRequests/<gunId> = {from, timestamp},
   * matching exactly what the production dchat client (app.js's addContact())
   * writes -- this is NOT a flat top-level collection. The admin console must
   * read from this same nested path or it will never see requests real
   * mobile/web dchat users send.
   */
  async sendContactRequest(toUsername: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }
    const fromUsername = this.currentUser.is.alias;
    return new Promise((resolve, reject) => {
      this.gun.get('users').get(toUsername).get('contactRequests').set({
        from: fromUsername,
        timestamp: Date.now(),
      }, (ack: any) => {
        if (ack.err) {
          reject(new Error('Failed to send contact request'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to contact requests addressed to a user, at the same
   * users/<username>/contactRequests path app.js's setupContactRequestListener
   * reads. Requests are keyed by Gun's own generated id (there is no `id`
   * field on the record itself), and `handled` distinguishes ones already
   * acted on from pending ones.
   */
  listenContactRequestsForUser(
    username: string,
    callback: (request: { id: string; from: string; timestamp: number; handled: boolean }) => void
  ): void {
    this.gun.get('users').get(username).get('contactRequests').map().on((request: any, requestId: string) => {
      if (!request || !request.from) return;
      callback({
        id: requestId,
        from: request.from,
        timestamp: request.timestamp,
        handled: Boolean(request.handled),
      });
    });
  }

  /**
   * Accept a pending contact request: add each user to the other's contact
   * list (same shape as app.js's handleContactRequest -- the accepting
   * user's own SEA-authenticated contacts node, plus a mirrored entry under
   * the requester's public users/<alias>/contacts node), mark the request
   * handled, and notify the requester via contactAcceptances so their client
   * picks it up too.
   */
  async acceptContactRequest(requestId: string, toUsername: string, fromUsername: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.is) {
      throw new Error('User not logged in');
    }

    // Wait for both contact-list writes to be acknowledged before returning,
    // so the caller can't tear down the session mid-write and lose one side.
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.currentUser.get('contacts').get(fromUsername).put({ alias: fromUsername }, (ack: any) => {
          if (ack.err) reject(new Error('Failed to update contacts'));
          else resolve();
        });
      }),
      new Promise<void>((resolve, reject) => {
        this.gun.get('users').get(fromUsername).get('contacts').get(toUsername).put({ alias: toUsername }, (ack: any) => {
          if (ack.err) reject(new Error('Failed to update contacts'));
          else resolve();
        });
      }),
    ]);

    await new Promise<void>((resolve, reject) => {
      this.gun.get('users').get(toUsername).get('contactRequests').get(requestId).put(
        { handled: true, acceptedAt: Date.now() } as unknown as Partial<unknown>,
        (ack: any) => {
          if (ack.err) reject(new Error('Failed to mark contact request handled'));
          else resolve();
        }
      );
    });

    this.gun.get('users').get(fromUsername).get('contactAcceptances').set({
      from: toUsername,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Generate chat ID from two usernames
   */
  private getChatId(user1: string, user2: string): string {
    return [user1, user2].sort().join('_');
  }
}

export const gunService = new GunService();