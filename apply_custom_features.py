from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "ddnet")

def replace_once(relative_path: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative_path
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match in {relative_path}, found {count}")
    source = source.replace(old, new, 1)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(source)

# Configuration: all custom settings are added in one deterministic location.
replace_once(
    "src/engine/shared/config_variables.h",
    'MACRO_CONFIG_INT(ClDummyCopyMoves, cl_dummy_copy_moves, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_INSENSITIVE, "Whether dummy should copy your moves")',
    '''MACRO_CONFIG_INT(ClDummyCopyMoves, cl_dummy_copy_moves, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_INSENSITIVE, "Whether dummy should copy your moves")
MACRO_CONFIG_INT(ClDummyHammerOnW, cl_dummy_hammer_on_w, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Whether dummy hammers while holding W")
MACRO_CONFIG_INT(ClDummyHammerWSpeed, cl_dummy_hammer_w_speed, 10, 1, 25, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Dummy hammer attempt speed while holding W")
MACRO_CONFIG_INT(ClPixelWalk, cl_pixelwalk, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Enable PixelWalk while the +pixelwalk bind is held")
MACRO_CONFIG_INT(ClPixelWalkSpeed, cl_pixelwalk_speed, 5, 1, 10, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "PixelWalk movement speed")
MACRO_CONFIG_INT(ClAvoidFreeze, cl_avoid_freeze, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Avoid moving into nearby freeze tiles")
MACRO_CONFIG_INT(ClAvoidFreezeRange, cl_avoid_freeze_range, 1, 1, 4, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Avoid Freeze stopping distance, in 20-pixel steps")
MACRO_CONFIG_INT(ClHookAim, cl_hook_aim, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Automatically hook players inside the cursor FOV")
MACRO_CONFIG_INT(ClHookAimFov, cl_hook_aim_fov, 96, 16, 256, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Hook Aim FOV radius in world units")
MACRO_CONFIG_INT(ClHookAimShowFov, cl_hook_aim_show_fov, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Show the Hook Aim FOV circle")''',
    "configuration variables",
)

# W-triggered dummy hammer. The physical W key is read without replacing the user's W bind.
replace_once(
    "src/game/client/gameclient.cpp",
    'if(!g_Config.m_ClDummyHammer)\n\t{',
    '''const bool DummyHammerOnW = g_Config.m_ClDummyHammerOnW &&
		Input()->KeyIsPressed(KEY_W) &&
		Client()->State() == IClient::STATE_ONLINE &&
		!m_Menus.IsActive() && !m_Chat.IsActive() && !m_GameConsole.IsActive() &&
		!m_Motd.IsActive() && !m_KeyBinder.IsActive();
	const bool UseDummyHammer = g_Config.m_ClDummyHammer || DummyHammerOnW;

	if(!UseDummyHammer)
	{''',
    "W hammer input",
)
replace_once(
    "src/game/client/gameclient.cpp",
    "if(m_DummyFire % 25 != 0)",
    '''const unsigned int HammerInterval = DummyHammerOnW ?
			(unsigned int)(26 - g_Config.m_ClDummyHammerWSpeed) : 25U;
		if(m_DummyFire % HammerInterval != 0)''',
    "W hammer speed",
)

replace_once(
    "src/game/client/components/controls.cpp",
    "#include <base/dbg.h>\n",
    "#include <base/color.h>\n#include <base/dbg.h>\n",
    "FOV circle color include",
)

# PixelWalk state and key-held command.
replace_once(
    "src/game/client/components/controls.h",
    "\tint m_aShowHookColl[NUM_DUMMIES];",
    "\tint m_aShowHookColl[NUM_DUMMIES];\n\tint m_aManualHook[NUM_DUMMIES];\n\tint m_aPixelWalk[NUM_DUMMIES];\n\tint m_aAvoidFreezeOverride[NUM_DUMMIES];\n\tint m_PixelWalkTick;",
    "PixelWalk controls state",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "#include <game/localization.h>\n",
    "#include <game/localization.h>\n#include <game/mapitems.h>\n",
    "map tile definitions include",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "#include <algorithm>\n",
    '''#include <algorithm>

static bool IsAvoidFreezeTile(int Tile)
{
	return Tile == TILE_FREEZE || Tile == TILE_DFREEZE || Tile == TILE_LFREEZE;
}

static bool IsAvoidFreezeAt(const CCollision &Collision, vec2 Pos)
{
	const int MapIndex = Collision.GetPureMapIndex(Pos);
	if(IsAvoidFreezeTile(Collision.GetTileIndex(MapIndex)) ||
		IsAvoidFreezeTile(Collision.GetFrontTileIndex(MapIndex)))
		return true;

	CDoorTile DoorTile;
	Collision.GetDoorTile(MapIndex, &DoorTile);
	return IsAvoidFreezeTile(DoorTile.m_Index);
}

static bool IsAvoidFreezeAhead(const CCollision &Collision, vec2 Pos, int Direction, int MaxDistance)
{
	for(int Distance = 20; Distance <= MaxDistance; Distance += 8)
	{
		for(int OffsetY = -14; OffsetY <= 14; OffsetY += 14)
		{
			if(IsAvoidFreezeAt(Collision, Pos + vec2(Direction * Distance, OffsetY)))
				return true;
		}
	}
	return false;
}
''',
    "Avoid Freeze tile helpers",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "CControls::CControls()\n{\n",
    "CControls::CControls()\n{\n\tmem_zero(&m_aManualHook, sizeof(m_aManualHook));\n\tm_PixelWalkTick = 0;\n\tmem_zero(&m_aPixelWalk, sizeof(m_aPixelWalk));\n\tmem_zero(&m_aAvoidFreezeOverride, sizeof(m_aAvoidFreezeOverride));\n",
    "PixelWalk constructor initialization",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "void CControls::OnReset()\n{\n\tResetInput(0);",
    "void CControls::OnReset()\n{\n\tm_PixelWalkTick = 0;\n\tResetInput(0);",
    "PixelWalk reset",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "void CControls::ResetInput(int Dummy)\n{\n\tm_aLastData[Dummy].m_Direction = 0;",
    "void CControls::ResetInput(int Dummy)\n{\n\tm_aManualHook[Dummy] = 0;\n\tm_aPixelWalk[Dummy] = 0;\n\tm_aAvoidFreezeOverride[Dummy] = 0;\n\tm_aLastData[Dummy].m_Direction = 0;",
    "PixelWalk input reset",
)
replace_once(
    "src/game/client/components/controls.cpp",
    '''		Console()->Register("+showhookcoll", "", CFGFLAG_CLIENT, ConKeyInputState, &s_State, "Show Hook Collision");
	}

	{
		static CInputSet''',
    '''		Console()->Register("+showhookcoll", "", CFGFLAG_CLIENT, ConKeyInputState, &s_State, "Show Hook Collision");
	}
	{
		static CInputState s_PixelWalk = {this, {&m_aPixelWalk[0], &m_aPixelWalk[1]}, false};
		Console()->Register("+pixelwalk", "", CFGFLAG_CLIENT, ConKeyInputState, &s_PixelWalk, "PixelWalk while held");
	}
	{
		static CInputState s_AvoidFreezeOverride = {this, {&m_aAvoidFreezeOverride[0], &m_aAvoidFreezeOverride[1]}, false};
		Console()->Register("+avoidfreeze_override", "", CFGFLAG_CLIENT, ConKeyInputState, &s_AvoidFreezeOverride, "Temporarily bypass Avoid Freeze while held");
	}

	{
		static CInputSet''',
    "PixelWalk bind command",
)

replace_once(
    "src/game/client/components/controls.cpp",
    "static CInputState s_State = {this, {&m_aInputData[0].m_Hook, &m_aInputData[1].m_Hook}, true};",
    "static CInputState s_State = {this, {&m_aManualHook[0], &m_aManualHook[1]}, true};",
    "manual hook state binding",
)

# Movement assists are applied after normal and dummy input processing, before sending the packet.
replace_once(
    "src/game/client/components/controls.cpp",
    "\t\t// check if we need to send input",
    '''		// PixelWalk: throttle direction updates while its hold-bind is active.
		if(g_Config.m_ClPixelWalk && m_aPixelWalk[g_Config.m_ClDummy] && m_aInputData[g_Config.m_ClDummy].m_Direction != 0)
		{
			const int PixelWalkSpeed = std::clamp(g_Config.m_ClPixelWalkSpeed, 1, 10);
			const int PixelWalkInterval = (10 + PixelWalkSpeed - 1) / PixelWalkSpeed;
			m_PixelWalkTick = (m_PixelWalkTick + 1) % PixelWalkInterval;
			if(m_PixelWalkTick != 0)
				m_aInputData[g_Config.m_ClDummy].m_Direction = 0;
		}
		else
			m_PixelWalkTick = 0;

		// Avoid Freeze: release horizontal movement before entering a freeze tile.
		if(g_Config.m_ClAvoidFreeze && !m_aAvoidFreezeOverride[g_Config.m_ClDummy] &&
			(m_aInputData[g_Config.m_ClDummy].m_PlayerFlags & PLAYERFLAG_PLAYING) &&
			m_aInputData[g_Config.m_ClDummy].m_Direction != 0 &&
			!GameClient()->m_Snap.m_SpecInfo.m_Active)
		{
			const int LocalId = GameClient()->m_aLocalIds[g_Config.m_ClDummy];
			if(LocalId >= 0 && LocalId < MAX_CLIENTS && GameClient()->m_Snap.m_aCharacters[LocalId].m_Active)
			{
				const auto &Character = GameClient()->m_Snap.m_aCharacters[LocalId].m_Cur;
				const vec2 PlayerPos(Character.m_X, Character.m_Y);
				const int Direction = m_aInputData[g_Config.m_ClDummy].m_Direction;
				const int Range = std::clamp(g_Config.m_ClAvoidFreezeRange, 1, 4) * 20;
				if(!IsAvoidFreezeAt(*Collision(), PlayerPos) &&
					IsAvoidFreezeAhead(*Collision(), PlayerPos, Direction, Range))
				{
					m_aInputData[g_Config.m_ClDummy].m_Direction = 0;
				}
			}
		}

		// Hook Aim: automatically hook the closest eligible player inside the cursor-centered FOV.
		const int ActiveDummy = g_Config.m_ClDummy;
		m_aInputData[ActiveDummy].m_Hook = m_aManualHook[ActiveDummy] != 0;
		if(g_Config.m_ClHookAim && !m_aManualHook[ActiveDummy] &&
			(m_aInputData[ActiveDummy].m_PlayerFlags & PLAYERFLAG_PLAYING) &&
			!GameClient()->m_Snap.m_SpecInfo.m_Active)
		{
			const int LocalId = GameClient()->m_aLocalIds[ActiveDummy];
			if(LocalId >= 0 && LocalId < MAX_CLIENTS && GameClient()->m_Snap.m_aCharacters[LocalId].m_Active)
			{
				const vec2 CursorPosition = CursorWorldPos();
				const float FovRadius = (float)std::clamp(g_Config.m_ClHookAimFov, 16, 256);
				int BestTarget = -1;
				float BestDistance = FovRadius;
				for(int ClientId = 0; ClientId < MAX_CLIENTS; ++ClientId)
				{
					const auto &Target = GameClient()->m_aClients[ClientId];
					if(ClientId == LocalId || !Target.m_Active || Target.m_Team == TEAM_SPECTATORS ||
						Target.m_Spec || Target.m_Paused || Target.m_HookHitDisabled ||
						!GameClient()->m_Snap.m_aCharacters[ClientId].m_Active)
						continue;
					const float DistanceToCursor = length(Target.m_Predicted.m_Pos - CursorPosition);
					if(DistanceToCursor <= BestDistance)
					{
						BestDistance = DistanceToCursor;
						BestTarget = ClientId;
					}
				}
				if(BestTarget >= 0)
				{
					const vec2 HookDirection = GameClient()->m_aClients[BestTarget].m_Predicted.m_Pos - GameClient()->m_LocalCharacterPos;
					if(length(HookDirection) > 0.001f)
					{
						m_aInputData[ActiveDummy].m_TargetX = round_to_int(HookDirection.x);
						m_aInputData[ActiveDummy].m_TargetY = round_to_int(HookDirection.y);
						m_aInputData[ActiveDummy].m_Hook = 1;
					}
				}
			}
		}

		// check if we need to send input''',
    "PixelWalk and Avoid Freeze steering",
)

replace_once(
    "src/game/client/components/controls.cpp",
    "\t\tm_aTargetPos[g_Config.m_ClDummy] = m_aMousePos[g_Config.m_ClDummy];\n\t}\n}\n\nbool CControls::OnCursorMove",
    """\t\tm_aTargetPos[g_Config.m_ClDummy] = m_aMousePos[g_Config.m_ClDummy];
\t}

\tif(g_Config.m_ClHookAim && g_Config.m_ClHookAimShowFov)
\t{
\t\tconst vec2 Center = CursorWorldPos();
\t\tconst float Radius = (float)std::clamp(g_Config.m_ClHookAimFov, 16, 256);
\t\tconstexpr int SEGMENTS = 64;
\t\tIGraphics::CLineItem aFovLines[SEGMENTS];
\t\tfor(int i = 0; i < SEGMENTS; ++i)
\t\t{
\t\t\tconst float Angle0 = 2.0f * pi * (float)i / SEGMENTS;
\t\t\tconst float Angle1 = 2.0f * pi * (float)(i + 1) / SEGMENTS;
\t\t\tconst vec2 From = Center + direction(Angle0) * Radius;
\t\t\tconst vec2 To = Center + direction(Angle1) * Radius;
\t\t\taFovLines[i] = IGraphics::CLineItem(From, To);
\t\t}
\t\tGraphics()->TextureClear();
\t\tGraphics()->SetColor(ColorRGBA(0.2f, 0.85f, 1.0f, 0.8f));
\t\tGraphics()->LinesBegin();
\t\tGraphics()->LinesDraw(aFovLines, SEGMENTS);
\t\tGraphics()->LinesEnd();
\t\tGraphics()->SetColor(ColorRGBA(1.0f, 1.0f, 1.0f, 1.0f));
\t}
}

bool CControls::OnCursorMove""",
    "Hook Aim FOV drawing",
)

# Controls menu: make PixelWalk bindable and expose the three assist settings.
replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},',
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("PixelWalk"), "+pixelwalk"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("Avoid Freeze Override"), "+avoidfreeze_override"},',
    "PixelWalk bind option",
)
replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '''	RenderSettingsBindsBlock(EBindOptionGroup::PRACTICE, &RightColumn, Localize("Practice"));
	RenderSettingsBindsBlock(EBindOptionGroup::MISCELLANEOUS, &RightColumn, Localize("Miscellaneous"));''',
    '''	RenderSettingsBindsBlock(EBindOptionGroup::PRACTICE, &RightColumn, Localize("Practice"));
	RenderSettingsBlock(2.0f * BUTTON_HEIGHT + BUTTON_SPACING, &RightColumn, Localize("PixelWalk"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClPixelWalk, Localize("Enable PixelWalk"), g_Config.m_ClPixelWalk, &Button))
				g_Config.m_ClPixelWalk ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClPixelWalk, &Button, Localize("Enable PixelWalk while holding its bind"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClPixelWalkSpeed, &g_Config.m_ClPixelWalkSpeed, &Button, Localize("Speed"), 1, 10);
			Ui()->DoToolTip(&g_Config.m_ClPixelWalkSpeed, &Button, Localize("Higher values make PixelWalk movement faster"));
		});
	RenderSettingsBlock(2.0f * BUTTON_HEIGHT + BUTTON_SPACING, &RightColumn, Localize("Dummy Hammer"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClDummyHammerOnW, Localize("Enable Dummy Hammer on W"), g_Config.m_ClDummyHammerOnW, &Button))
				g_Config.m_ClDummyHammerOnW ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClDummyHammerOnW, &Button, Localize("Automatically hammer with Dummy while holding W"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClDummyHammerWSpeed, &g_Config.m_ClDummyHammerWSpeed, &Button, Localize("Dummy Hammer Speed"), 1, 25);
			Ui()->DoToolTip(&g_Config.m_ClDummyHammerWSpeed, &Button, Localize("Higher values send hammer attempts more frequently; actual hit speed is limited by server reload"));
		});
	RenderSettingsBlock(2.0f * BUTTON_HEIGHT + BUTTON_SPACING, &RightColumn, Localize("Avoid Freeze"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClAvoidFreeze, Localize("Enable Avoid Freeze"), g_Config.m_ClAvoidFreeze, &Button))
				g_Config.m_ClAvoidFreeze ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClAvoidFreeze, &Button, Localize("Stop before freeze tiles; hold Avoid Freeze Override to enter intentionally"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClAvoidFreezeRange, &g_Config.m_ClAvoidFreezeRange, &Button, Localize("Stop Distance"), 1, 4);
			Ui()->DoToolTip(&g_Config.m_ClAvoidFreezeRange, &Button, Localize("Default is a close approach; increase only if you need more braking distance"));
		});
	RenderSettingsBlock(3.0f * BUTTON_HEIGHT + 2.0f * BUTTON_SPACING, &RightColumn, Localize("Hook Aim"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClHookAim, Localize("Enable Hook Aim"), g_Config.m_ClHookAim, &Button))
				g_Config.m_ClHookAim ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClHookAim, &Button, Localize("Automatically hook the closest player inside the cursor FOV"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClHookAimFov, &g_Config.m_ClHookAimFov, &Button, Localize("Hook Aim FOV"), 16, 256);
			Ui()->DoToolTip(&g_Config.m_ClHookAimFov, &Button, Localize("Radius of the FOV circle around your cursor, in game units"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClHookAimShowFov, Localize("Show FOV"), g_Config.m_ClHookAimShowFov, &Button))
				g_Config.m_ClHookAimShowFov ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClHookAimShowFov, &Button, Localize("Draw the FOV circle around your cursor"));
		});
	RenderSettingsBindsBlock(EBindOptionGroup::MISCELLANEOUS, &RightColumn, Localize("Miscellaneous"));''',
    "Controls menu settings blocks",
)

# HUD overlay: list only custom features whose enable switches are on.
replace_once(
    "src/game/client/components/hud.h",
    "\tvoid RenderLocalTime(float x);",
    "\tvoid RenderLocalTime(float x);\n\tvoid RenderCustomFeatureStatus();",
    "HUD feature status declaration",
)
replace_once(
    "src/game/client/components/hud.cpp",
    "\t\tRenderLocalTime((m_Width / 7) * 3);",
    "\t\tRenderLocalTime((m_Width / 7) * 3);\n\t\tRenderCustomFeatureStatus();",
    "HUD feature status render call",
)
replace_once(
    "src/game/client/components/hud.cpp",
    "void CHud::OnNewSnapshot()\n{",
    '''void CHud::RenderCustomFeatureStatus()
{
\tconst char *apEnabledFeatures[5];
\tint NumFeatures = 0;
\tif(g_Config.m_ClAvoidFreeze)
\t\tapEnabledFeatures[NumFeatures++] = Localize("Avoid Freeze");
\tif(g_Config.m_ClPixelWalk)
\t\tapEnabledFeatures[NumFeatures++] = Localize("PixelWalk");
\tif(g_Config.m_ClDummyHammerOnW)
\t\tapEnabledFeatures[NumFeatures++] = Localize("Dummy Hammer (W)");
\tif(g_Config.m_ClHookAim)
\t\tapEnabledFeatures[NumFeatures++] = Localize("Hook Aim");
\tif(g_Config.m_ClAvoidFreeze && GameClient()->m_Controls.m_aAvoidFreezeOverride[g_Config.m_ClDummy])
\t\tapEnabledFeatures[NumFeatures++] = Localize("Freeze Override");

\tif(NumFeatures == 0)
\t\treturn;

\tconst float FontSize = 7.0f;
\tconst float LineHeight = 9.0f;
\tconst float Padding = 5.0f;
\tfloat TextWidth = 0.0f;
\tfor(int i = 0; i < NumFeatures; ++i)
\t\tTextWidth = std::max(TextWidth, TextRender()->TextWidth(FontSize, apEnabledFeatures[i], -1, -1.0f));

\tconst float BoxWidth = TextWidth + Padding * 2.0f;
\tconst float BoxHeight = NumFeatures * LineHeight + Padding * 2.0f;
\tconst float X = m_Width - BoxWidth - 5.0f;
\tconst float Y = 16.0f;
\tGraphics()->DrawRect(X, Y, BoxWidth, BoxHeight, ColorRGBA(0.0f, 0.0f, 0.0f, 0.45f), IGraphics::CORNER_ALL, 4.0f);

\tTextRender()->TextColor(1.0f, 1.0f, 1.0f, 1.0f);
\tfor(int i = 0; i < NumFeatures; ++i)
\t\tTextRender()->Text(X + Padding, Y + Padding + i * LineHeight, FontSize, apEnabledFeatures[i], -1.0f);
\tTextRender()->TextColor(TextRender()->DefaultTextColor());
}

void CHud::OnNewSnapshot()
{''',
    "HUD feature status implementation",
)

# Final source checks prevent silently producing a client without one of the requested features.
checks = {
    "src/engine/shared/config_variables.h": [
        "cl_pixelwalk", "cl_pixelwalk_speed", "cl_dummy_hammer_w_speed",
        "cl_avoid_freeze", "cl_avoid_freeze_range",
        "cl_hook_aim", "cl_hook_aim_fov", "cl_hook_aim_show_fov",
    ],
    "src/game/client/components/controls.cpp": [
        'Console()->Register("+pixelwalk"', 'Console()->Register("+avoidfreeze_override"', "IsAvoidFreezeAhead", "m_aAvoidFreezeOverride", "m_ClAvoidFreeze", "m_aManualHook", "m_ClHookAim",
        "CursorWorldPos()", "Target.m_Predicted.m_Pos", "LinesDraw(aFovLines, SEGMENTS)",
    ],
    "src/game/client/components/menus_settings_controls.cpp": [
        'Localize("PixelWalk")', 'Localize("Dummy Hammer")', 'Localize("Avoid Freeze")',
    ],
    "src/game/client/gameclient.cpp": [
        "ClDummyHammerOnW", "ClDummyHammerWSpeed",
    ],
    "src/game/client/components/hud.cpp": [
        "RenderCustomFeatureStatus", 'Localize("Avoid Freeze")',
        'Localize("PixelWalk")', 'Localize("Dummy Hammer (W)")', 'Localize("Hook Aim")', "m_aAvoidFreezeOverride",
    ],
    "src/game/client/components/hud.h": [
        "RenderCustomFeatureStatus",
    ],
    "src/game/client/components/menus_settings_controls.cpp": [
        'Localize("Enable Hook Aim")', 'Localize("Hook Aim FOV")', 'Localize("Show FOV")',
    ],
}
for relative_path, needles in checks.items():
    content = (ROOT / relative_path).read_text(encoding="utf-8")
    missing = [needle for needle in needles if needle not in content]
    if missing:
        raise SystemExit(f"Feature verification failed in {relative_path}: missing {missing}")

print("Applied and verified: W Dummy Hammer, PixelWalk, Avoid Freeze, and Hook Aim.")
