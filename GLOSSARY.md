# TaskFlow

The domain language of TaskFlow: teams collaborate inside isolated workspaces, talking in channels and tracking work on boards. These are the words used in code, API, database and UI. Technical concepts (JWT, transaction, outbox…) are explained in `WORKFLOW-VI.md` §11, not here.

## Language

### Accounts

**User**:
A person who has signed up with an email and a password. The name and avatar shown to others are part of the User, not a separate concept.
_Avoid_: Account, Profile
_VI_: người dùng có tài khoản đăng nhập.

**Session**:
One sign-in of a User on one device, lasting until the User signs out, it expires, or it is revoked.
_Avoid_: Login, Token
_VI_: một lần đăng nhập trên một thiết bị.

**Verified email**:
An email address its User has confirmed by opening the link sent to it. Accepting an Invitation requires a verified email equal to the invited address.
_Avoid_: Confirmed, Activated
_VI_: email đã xác thực.

**Blocked user**:
A User the operator has blocked directly in the database, for example after abuse. A Blocked user cannot sign in and loses access at once. There is no screen to block or unblock.
_Avoid_: Inactive, Suspended, Banned
_VI_: người dùng bị người vận hành khoá (không có giao diện).

**Deleted user**:
A User the operator has deleted. They cannot sign in and are removed from every Workspace; their Messages stay, shown under the name "Deleted user". Users cannot delete themselves.
_VI_: người dùng đã bị xoá; tin nhắn vẫn còn, hiện tên "Deleted user".

### Workspaces

**Workspace**:
An isolated space where a group of Users collaborates, identified by its name (not necessarily unique). Nothing inside one Workspace is visible from another.
_Avoid_: Organization, Team, Tenant
_VI_: không gian làm việc riêng của một nhóm.

**Deleted workspace**:
A Workspace its Owner has deleted. Nobody can open it or anything in it, and it cannot be restored.
_Avoid_: Archived, Closed
_VI_: workspace đã bị xoá, không khôi phục được.

**Member**:
A User who belongs to a Workspace, with exactly one Role in it. "Member" alone always means a Workspace member.
_Avoid_: Workspace user, Participant
_VI_: thành viên của workspace.

**Role**:
The level of permission a Member has in one Workspace: Owner, Admin or Member role. A User can hold different Roles in different Workspaces.
_Avoid_: Permission level, Global role
_VI_: vai trò của thành viên trong một workspace.

**Owner**:
The Role held by exactly one Member of each Workspace, who can delete the Workspace and transfer ownership.
_VI_: chủ sở hữu duy nhất của workspace.

**Ownership transfer**:
The Owner hands the Owner role to another Member. The previous Owner becomes an Admin.
_VI_: chuyển quyền sở hữu; chủ cũ trở thành Admin.

**Admin**:
The Role that manages the Workspace and its Members who hold the Member role.
_VI_: quản trị viên.

**Member role**:
The Role with the fewest permissions. Always written "Member role" (or `MEMBER`), never just "member", to keep it apart from **Member**.
_Avoid_: Basic, Regular, User role
_VI_: vai trò thấp nhất.

**Leave**:
A Member removes themself from a Workspace. The Owner cannot leave without an Ownership transfer first.
_VI_: tự rời workspace.

**Remove**:
An Owner or Admin takes a Member out of a Workspace. A removed User can be invited again: there is no ban.
_Avoid_: Kick, Ban, Delete member
_VI_: bị xoá khỏi workspace (có thể được mời lại).

**Invitation**:
An offer, sent to an email address, to join a Workspace with a given Role. It is Pending, Accepted, Revoked or Expired.
_Avoid_: Invite (as a noun)
_VI_: lời mời tham gia workspace.

**Inviter**:
The Owner or Admin who creates an Invitation.
_VI_: người gửi lời mời.

**Invitee**:
The person an Invitation is addressed to, known by their email address. They may not have a User yet.
_VI_: người được mời (có thể chưa có tài khoản).

**Pending** / **Accepted** / **Revoked** / **Expired**:
The states of an Invitation. Pending: waiting for the Invitee. Accepted: the Invitee joined. Revoked: withdrawn by an Owner or Admin. Expired: still Pending after its deadline, so it can no longer be accepted.
_Avoid_: Cancelled
_VI_: các trạng thái của lời mời: chờ / đã nhận / đã thu hồi / hết hạn.

### Messaging

**Channel**:
A place inside a Workspace where Members exchange Messages. It is a Public channel or a Private channel.
_Avoid_: Room, Chat, Conversation
_VI_: kênh trò chuyện trong workspace.

**Public channel**:
A Channel every Member can see and join on their own.
_VI_: kênh công khai trong workspace.

**Private channel**:
A Channel only its Channel Members can see. Members are added to it; they cannot join on their own.
_VI_: kênh riêng, chỉ thành viên kênh thấy.

**Default channel**:
The Public channel every Workspace has, named "general". Every Member is in it; it cannot be deleted or left.
_Avoid_: General channel, Main channel
_VI_: kênh mặc định "general", ai cũng ở trong.

**Channel Member**:
A Member who has joined a particular Channel. Always written in full.
_Avoid_: Member (alone), Participant
_VI_: thành viên của một channel.

**Message**:
What a Member sends to a Channel. It can be edited or deleted by its sender; a deleted Message leaves a placeholder so its Thread stays readable.
_Avoid_: Post, Comment, Chat
_VI_: tin nhắn.

**Reply**:
A Message that answers another Message. A Reply cannot have Replies of its own.
_VI_: tin nhắn trả lời.

**Thread**:
A Message together with all its Replies.
_VI_: một tin nhắn gốc cùng các trả lời của nó.

**Mention**:
A reference to one Channel Member inside a Message, which notifies them. Only individual Channel Members can be mentioned: there is no @channel, @here or @everyone.
_Avoid_: Tag, Ping
_VI_: nhắc tên một thành viên kênh (không có nhắc cả nhóm).

**Attachment**:
A file attached to a Message, visible only to those who can see the Message. A User's avatar and a Workspace's logo are not Attachments.
_Avoid_: File, Upload (as nouns)
_VI_: file đính kèm của tin nhắn (riêng tư).

**Presence**:
Whether a Member is Online (has the app open) or Offline. There are no custom statuses.
_Avoid_: Status, Active
_VI_: trạng thái online / offline.

**Unread messages**:
The Messages of a Channel newer than the moment the Channel Member last read it. Opening the Channel marks it as read. There are no read receipts showing who saw a given Message.
_Avoid_: New messages, Seen
_VI_: tin chưa đọc (tính từ lần đọc cuối; không có "đã xem" theo từng người).

### Boards

**Board**:
A place inside a Workspace where Members track Tasks, organised in Columns.
_VI_: bảng Kanban.

**Column**:
One stage of a Board. Every Task is in exactly one Column, and Columns have an order.
_Avoid_: List, Lane, Swimlane, Stage, Status
_VI_: cột (giai đoạn) trên bảng.

**Done column**:
The one Column of a Board that means "finished". A Task moved into it becomes Completed; moved out, it is no longer Completed. A new Board's "Done" column is its Done column.
_VI_: cột "xong" duy nhất của bảng; kéo vào là hoàn thành.

**Task**:
A piece of work on a Board.
_Avoid_: Card, Ticket, Issue, Todo
_VI_: một đầu việc.

**Completed**:
A Task that is in its Board's Done column.
_Avoid_: Closed, Resolved
_VI_: đã hoàn thành.

**Assignee**:
The one Member responsible for a Task. A Task has at most one Assignee.
_Avoid_: Owner, Responsible
_VI_: người được giao việc (tối đa một người).

**Due date**:
The date and time by which a Task should be Completed.
_Avoid_: Deadline
_VI_: hạn chót của task.

**Reminder**:
A Notification sent to the Assignee about 24 hours before the Due date of a Task that is not Completed, once per Due date.
_VI_: nhắc hạn, khoảng 24 giờ trước hạn chót.

### Notifications

**Notification**:
A message to one User about something that concerns them: an assignment, a Mention, an upcoming Due date, an Invitation, a new Member. It appears in the app and, for some kinds, is also emailed. It belongs to the User, not to a Workspace. There is no activity feed.
_Avoid_: Alert, Activity
_VI_: thông báo gửi cho một người dùng.
